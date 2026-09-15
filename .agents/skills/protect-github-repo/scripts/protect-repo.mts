#!/usr/bin/env -S node --experimental-strip-types
import { Buffer } from "node:buffer"
import { ghApi, ghApiJson } from "./lib/gh.mts"
import {
  RULESET_NAME,
  buildCanonicalRuleset,
  extractRequiredStatusCheckContexts,
  rulesetCoreMatches,
  stripRulesetMetadata,
  withoutStatusChecksRule,
} from "./lib/ruleset.mts"
import { buildCanonicalCodeowners, findExistingCodeowners } from "./lib/codeowners.mts"
import { listAvailableChecks } from "./lib/statusChecks.mts"
import type { AvailableCheck } from "./lib/statusChecks.mts"
import { backupDirFor, writeBackup } from "./lib/backup.mts"
import { diffValues } from "./lib/diff.mts"
import type { DiffEntry } from "./lib/diff.mts"
import { bold, dim, green, red, yellow } from "./lib/color.mts"
import { confirmPrompt, multiselectPrompt } from "./lib/prompt.mts"

const DEFAULT_BYPASS_LOGIN = "activescott"

interface RepoInfo {
  default_branch: string
  private: boolean
  permissions?: { admin?: boolean }
  allow_auto_merge?: boolean
}

interface RulesetSummary {
  id: number
  name: string
  target: string
  enforcement: string
}

function usageAndExit(): never {
  console.error(
    [
      "usage:",
      "  ./protect-repo.mts inspect <owner>/<repo> [--bypass-user <login>] [--json]",
      "  ./protect-repo.mts apply <owner>/<repo> [--status-checks <comma-list|none>] " +
        "[--bypass-user <login>] [--overwrite-ruleset] [--overwrite-codeowners] " +
        "[--skip-ruleset] [--skip-codeowners] [--skip-auto-merge]",
      "    omitted --status-checks / --overwrite-* / --skip-* fall back to an interactive " +
        "prompt (requires a TTY)",
    ].join("\n"),
  )
  process.exit(1)
}

function parseRepoSpec(spec: string): { owner: string; repo: string } {
  const [owner, repo, ...rest] = spec.split("/")
  if (!owner || !repo || rest.length > 0) {
    throw new Error(`expected <owner>/<repo>, got "${spec}"`)
  }
  return { owner, repo }
}

const BOOLEAN_FLAGS = new Set([
  "json",
  "overwrite-ruleset",
  "overwrite-codeowners",
  "skip-ruleset",
  "skip-codeowners",
  "skip-auto-merge",
])

type Flags = Map<string, string | boolean>

function parseBooleanValue(key: string, rawValue: string): boolean {
  if (rawValue === "true" || rawValue === "1") {
    return true
  }
  if (rawValue === "false" || rawValue === "0") {
    return false
  }
  throw new Error(`--${key}=${rawValue} is not a valid boolean; use true/false`)
}

/** Parses `--flag`, `--flag value`, and `--flag=value`. Boolean flags never consume a bare next token as a value. */
function parseFlags(args: string[]): Flags {
  const flags: Flags = new Map()
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === undefined || !arg.startsWith("--")) {
      continue
    }
    const body = arg.slice(2)
    const eqIndex = body.indexOf("=")
    if (eqIndex !== -1) {
      const key = body.slice(0, eqIndex)
      const rawValue = body.slice(eqIndex + 1)
      flags.set(key, BOOLEAN_FLAGS.has(key) ? parseBooleanValue(key, rawValue) : rawValue)
      continue
    }
    if (BOOLEAN_FLAGS.has(body)) {
      flags.set(body, true)
      continue
    }
    const next = args[i + 1]
    if (next !== undefined && !next.startsWith("--")) {
      flags.set(body, next)
      i++
    } else {
      flags.set(body, true)
    }
  }
  return flags
}

function assertKnownFlags(flags: Flags, known: Set<string>): void {
  for (const key of flags.keys()) {
    if (!known.has(key)) {
      throw new Error(`unknown flag --${key}`)
    }
  }
}

function flagString(flags: Flags, key: string, fallback: string): string {
  const value = flags.get(key)
  return typeof value === "string" ? value : fallback
}

function flagBoolean(flags: Flags, key: string): boolean {
  return flags.get(key) === true
}

function getRepoInfo(owner: string, repo: string): RepoInfo {
  return ghApiJson<RepoInfo>([`repos/${owner}/${repo}`])
}

function resolveUserId(login: string): number {
  return ghApiJson<{ id: number }>([`users/${login}`]).id
}

function findBranchRulesets(owner: string, repo: string): Array<Record<string, unknown>> {
  // --paginate follows every page; --slurp wraps the pages into an outer array (one sub-array
  // per page) rather than a flat list, hence the .flat().
  const pages = ghApiJson<RulesetSummary[][]>([
    `repos/${owner}/${repo}/rulesets`,
    "--paginate",
    "--slurp",
  ])
  return pages
    .flat()
    .filter((summary) => summary.target === "branch")
    .map((summary) => ghApiJson<Record<string, unknown>>([`repos/${owner}/${repo}/rulesets/${summary.id}`]))
}

function putCodeowners(owner: string, repo: string, path: string, content: string, sha: string | null): void {
  const body: Record<string, unknown> = {
    message: sha ? "chore: update CODEOWNERS" : "chore: add CODEOWNERS",
    content: Buffer.from(content, "utf8").toString("base64"),
  }
  if (sha) {
    body.sha = sha
  }
  ghApi([`repos/${owner}/${repo}/contents/${path}`, "-X", "PUT", "--input", "-"], JSON.stringify(body))
}

interface RulesetReportEntry {
  id: number | null
  name: string
  coreMatchesCanonical: boolean
  currentRequiredStatusChecks: string[]
  diff: DiffEntry[]
  raw: Record<string, unknown>
}

type CodeownersReport =
  | { exists: true; path: string; matchesCanonical: boolean; content: string }
  | { exists: false; path: null; matchesCanonical: false; content: null }

interface InspectReport {
  repo: { owner: string; repo: string; defaultBranch: string; private: boolean; canAdmin: boolean }
  bypassUser: { login: string; id: number }
  rulesets: RulesetReportEntry[]
  codeowners: CodeownersReport
  canonicalCodeownersPreview: string
  availableStatusChecks: AvailableCheck[]
  autoMerge: { enabled: boolean }
}

function buildInspectReport(owner: string, repo: string, bypassLogin: string): InspectReport {
  const repoInfo = getRepoInfo(owner, repo)
  const bypassUserId = resolveUserId(bypassLogin)
  const canonical = buildCanonicalRuleset({ bypassUserId, requiredStatusCheckContexts: [] })

  const rulesets = findBranchRulesets(owner, repo).map((ruleset) => {
    const core = withoutStatusChecksRule(stripRulesetMetadata(ruleset))
    return {
      id: typeof ruleset.id === "number" ? ruleset.id : null,
      name: typeof ruleset.name === "string" ? ruleset.name : "",
      coreMatchesCanonical: rulesetCoreMatches(ruleset, canonical),
      currentRequiredStatusChecks: extractRequiredStatusCheckContexts(ruleset),
      diff: diffValues(canonical, core),
      raw: stripRulesetMetadata(ruleset),
    }
  })

  const existingCodeowners = findExistingCodeowners(owner, repo)
  const canonicalCodeowners = buildCanonicalCodeowners(bypassLogin)
  const codeowners: CodeownersReport = existingCodeowners
    ? {
        exists: true,
        path: existingCodeowners.path,
        matchesCanonical: existingCodeowners.content === canonicalCodeowners,
        content: existingCodeowners.content,
      }
    : { exists: false, path: null, matchesCanonical: false, content: null }

  return {
    repo: {
      owner,
      repo,
      defaultBranch: repoInfo.default_branch,
      private: repoInfo.private,
      canAdmin: repoInfo.permissions?.admin ?? false,
    },
    bypassUser: { login: bypassLogin, id: bypassUserId },
    rulesets,
    codeowners,
    canonicalCodeownersPreview: canonicalCodeowners,
    availableStatusChecks: listAvailableChecks(owner, repo, repoInfo.default_branch),
    autoMerge: { enabled: repoInfo.allow_auto_merge ?? false },
  }
}

function printDiffEntries(diff: DiffEntry[]): void {
  for (const entry of diff) {
    console.log(
      `      ${dim(entry.path)}: expected ${JSON.stringify(entry.expected)}, got ${JSON.stringify(entry.actual)}`,
    )
  }
}

function printInspectReport(report: InspectReport): void {
  const { repo, rulesets, codeowners, canonicalCodeownersPreview, availableStatusChecks, autoMerge } = report

  console.log(
    `${bold(`${repo.owner}/${repo.repo}`)}  ${dim(
      `(${repo.private ? "private" : "public"}, default branch: ${repo.defaultBranch}, admin: ${
        repo.canAdmin ? "yes" : "no"
      })`,
    )}`,
  )

  console.log()
  console.log(bold("Ruleset"))
  const named = rulesets.find((ruleset) => ruleset.name === RULESET_NAME)
  const others = rulesets.filter((ruleset) => ruleset.name !== RULESET_NAME)
  if (!named) {
    console.log(`  ${yellow("⚠")} no "${RULESET_NAME}" ruleset found — apply will create one`)
  } else if (named.coreMatchesCanonical) {
    console.log(`  ${green("✔")} "${RULESET_NAME}" matches canonical`)
  } else {
    console.log(`  ${red("✘")} "${RULESET_NAME}" exists but differs from canonical:`)
    printDiffEntries(named.diff)
  }
  const currentChecks = named?.currentRequiredStatusChecks ?? []
  if (currentChecks.length > 0) {
    console.log(`  ${green("✔")} required status checks: ${currentChecks.join(", ")}`)
  } else {
    console.log(`  ${yellow("⚠")} no required status checks`)
  }
  for (const other of others) {
    console.log(
      `  ${yellow("⚠")} other ruleset present: "${other.name}" (id ${String(other.id)}) — apply leaves this untouched`,
    )
  }

  console.log()
  console.log(bold("CODEOWNERS"))
  if (!codeowners.exists) {
    console.log(`  ${yellow("⚠")} not found — apply will create it at .github/CODEOWNERS`)
  } else if (codeowners.matchesCanonical) {
    console.log(`  ${green("✔")} matches canonical at ${codeowners.path}`)
  } else {
    console.log(`  ${red("✘")} exists at ${codeowners.path} but differs from canonical:`)
    console.log(`      current:   ${JSON.stringify(codeowners.content)}`)
    console.log(`      canonical: ${JSON.stringify(canonicalCodeownersPreview)}`)
  }

  console.log()
  console.log(bold("Auto-merge"))
  if (autoMerge.enabled) {
    console.log(`  ${green("✔")} enabled — PR authors can turn on "Auto-merge" once checks pass`)
  } else {
    console.log(`  ${yellow("⚠")} disabled — apply will enable it`)
  }

  const requiredContexts = new Set(currentChecks)
  const addableChecks = availableStatusChecks.filter((check) => !requiredContexts.has(check.context))

  console.log()
  console.log(bold("Available status checks"))
  if (availableStatusChecks.length === 0) {
    console.log(`  ${dim("none observed yet")}`)
  } else {
    for (const check of availableStatusChecks) {
      const status = requiredContexts.has(check.context)
        ? green("✔ required")
        : yellow("○ not required — could add")
      const flagHint = check.label === check.context ? "" : ` ${dim(`[--status-checks value: ${check.context}]`)}`
      console.log(`  - ${check.label}${flagHint} ${status}`)
    }
  }

  console.log()
  const rulesetNeedsOverwrite = named !== undefined && !named.coreMatchesCanonical
  const codeownersNeedsOverwrite = codeowners.exists && !codeowners.matchesCanonical
  const hasAddableChecks = addableChecks.length > 0
  const autoMergeNeedsEnable = !autoMerge.enabled
  if (
    !rulesetNeedsOverwrite &&
    !codeownersNeedsOverwrite &&
    !hasAddableChecks &&
    !autoMergeNeedsEnable &&
    named !== undefined &&
    codeowners.exists
  ) {
    console.log(`${green("✔")} already matches canonical — nothing to apply`)
  } else {
    if (hasAddableChecks) {
      console.log(
        `${yellow("⚠")} ${addableChecks.length} status check(s) available but not required: ` +
          `${addableChecks.map((check) => check.context).join(", ")}`,
      )
      console.log()
    }
    const statusChecksArg = availableStatusChecks.length === 0 ? "none" : "<ctx1,ctx2|none>"
    const overwriteFlags = [
      rulesetNeedsOverwrite ? "--overwrite-ruleset" : "",
      codeownersNeedsOverwrite ? "--overwrite-codeowners" : "",
    ]
      .filter((flag) => flag.length > 0)
      .join(" ")
    const verb = rulesetNeedsOverwrite || codeownersNeedsOverwrite ? "overwrite the repo with" : "apply"
    console.log(`To ${verb} the canonical settings shown above, run:`)
    console.log()
    console.log(
      `  ./protect-repo.mts apply ${repo.owner}/${repo.repo} ` +
        `--status-checks ${statusChecksArg}${overwriteFlags ? ` ${overwriteFlags}` : ""}`,
    )
    if (statusChecksArg !== "none") {
      console.log(dim("  (replace <ctx1,ctx2|none> with the checks to require, from the list above, or \"none\")"))
    }
  }
}

async function resolveRequiredStatusCheckContexts(
  owner: string,
  repo: string,
  defaultBranch: string,
  flags: Flags,
): Promise<string[]> {
  const statusChecksFlag = flags.get("status-checks")
  if (statusChecksFlag !== undefined) {
    if (typeof statusChecksFlag !== "string") {
      throw new Error('--status-checks requires a value: a comma-separated list of contexts, or "none"')
    }
    return statusChecksFlag === "none"
      ? []
      : statusChecksFlag
          .split(",")
          .map((context) => context.trim())
          .filter((context) => context.length > 0)
  }
  const available = listAvailableChecks(owner, repo, defaultBranch)
  if (available.length === 0) {
    return []
  }
  return multiselectPrompt(
    "Which status checks should be required to pass before merging?",
    available.map((check) => ({ label: check.label, value: check.context })),
  )
}

/**
 * Decides whether to overwrite an existing, differing mechanism: the matching --overwrite-*
 * flag, or a prompt. Callers only reach this after their own --skip-* guard has already let the
 * mechanism through, so there's no separate skip check to make here.
 */
async function resolveOverwriteDecision(
  flags: Flags,
  overwriteFlag: string,
  confirmMessage: string,
): Promise<boolean> {
  if (flagBoolean(flags, overwriteFlag)) {
    return true
  }
  return confirmPrompt(confirmMessage)
}

async function apply(owner: string, repo: string, flags: Flags): Promise<void> {
  const bypassLogin = flagString(flags, "bypass-user", DEFAULT_BYPASS_LOGIN)

  const repoInfo = getRepoInfo(owner, repo)
  if (!repoInfo.permissions?.admin) {
    throw new Error(`current gh auth does not have admin on ${owner}/${repo}; cannot change protection settings`)
  }

  const bypassUserId = resolveUserId(bypassLogin)
  const requiredStatusCheckContexts = await resolveRequiredStatusCheckContexts(
    owner,
    repo,
    repoInfo.default_branch,
    flags,
  )
  const canonical = buildCanonicalRuleset({ bypassUserId, requiredStatusCheckContexts })
  const canonicalWithoutStatusChecks = buildCanonicalRuleset({
    bypassUserId,
    requiredStatusCheckContexts: [],
  })
  const backupDir = backupDirFor(owner, repo)

  if (!flagBoolean(flags, "skip-ruleset")) {
    const existingRulesets = findBranchRulesets(owner, repo)
    const named = existingRulesets.find((ruleset) => ruleset.name === RULESET_NAME)
    const others = existingRulesets.filter((ruleset) => ruleset.name !== RULESET_NAME)
    if (others.length > 0) {
      console.error(
        `warning: ${others.length} other branch ruleset(s) present (${others
          .map((ruleset) => ruleset.name)
          .join(", ")}); leaving them untouched`,
      )
    }

    if (named) {
      const coreMatches = rulesetCoreMatches(named, canonicalWithoutStatusChecks)
      const checksMatch =
        JSON.stringify(extractRequiredStatusCheckContexts(named).slice().sort()) ===
        JSON.stringify(requiredStatusCheckContexts.slice().sort())
      if (coreMatches && checksMatch) {
        console.log(`ruleset "${RULESET_NAME}" already matches canonical; no change`)
      } else {
        console.log(`ruleset "${RULESET_NAME}" exists and differs from canonical:`)
        printDiffEntries(diffValues(canonicalWithoutStatusChecks, withoutStatusChecksRule(stripRulesetMetadata(named))))
        const overwrite = await resolveOverwriteDecision(
          flags,
          "overwrite-ruleset",
          `Overwrite the existing "${RULESET_NAME}" ruleset on ${owner}/${repo}?`,
        )
        if (overwrite) {
          const backupPath = writeBackup(
            backupDir,
            `ruleset-${String(named.id)}.json`,
            JSON.stringify(named, null, 2),
          )
          console.log(`backed up existing ruleset to ${backupPath}`)
          ghApi(
            [`repos/${owner}/${repo}/rulesets/${String(named.id)}`, "-X", "PUT", "--input", "-"],
            JSON.stringify(canonical),
          )
          console.log(`updated ruleset "${RULESET_NAME}"`)
        } else {
          console.log(`leaving existing ruleset "${RULESET_NAME}" as-is`)
        }
      }
    } else {
      ghApi([`repos/${owner}/${repo}/rulesets`, "-X", "POST", "--input", "-"], JSON.stringify(canonical))
      console.log(`created ruleset "${RULESET_NAME}"`)
    }
  }

  if (!flagBoolean(flags, "skip-codeowners")) {
    const canonicalContent = buildCanonicalCodeowners(bypassLogin)
    const existing = findExistingCodeowners(owner, repo)
    if (existing) {
      if (existing.content === canonicalContent) {
        console.log(`CODEOWNERS at ${existing.path} already matches canonical; no change`)
      } else {
        console.log(`CODEOWNERS exists at ${existing.path} and differs from canonical:`)
        console.log(`      current:   ${JSON.stringify(existing.content)}`)
        console.log(`      canonical: ${JSON.stringify(canonicalContent)}`)
        const overwrite = await resolveOverwriteDecision(
          flags,
          "overwrite-codeowners",
          `Overwrite CODEOWNERS at ${existing.path} on ${owner}/${repo}?`,
        )
        if (overwrite) {
          const backupPath = writeBackup(backupDir, "CODEOWNERS.backup", existing.content)
          console.log(`backed up existing CODEOWNERS to ${backupPath}`)
          putCodeowners(owner, repo, existing.path, canonicalContent, existing.sha)
          console.log(`updated CODEOWNERS at ${existing.path}`)
        } else {
          console.log(`leaving existing CODEOWNERS at ${existing.path} as-is`)
        }
      }
    } else {
      putCodeowners(owner, repo, ".github/CODEOWNERS", canonicalContent, null)
      console.log("created .github/CODEOWNERS")
    }
  }

  if (!flagBoolean(flags, "skip-auto-merge")) {
    if (repoInfo.allow_auto_merge) {
      console.log("auto-merge already enabled; no change")
    } else {
      ghApi([`repos/${owner}/${repo}`, "-X", "PATCH", "-F", "allow_auto_merge=true"])
      console.log("enabled auto-merge (PR authors can now turn on \"Auto-merge\")")
    }
  }
}

async function main(): Promise<void> {
  const [command, repoSpec, ...rest] = process.argv.slice(2)
  if (!command || !repoSpec) {
    usageAndExit()
  }
  const { owner, repo } = parseRepoSpec(repoSpec)
  const flags = parseFlags(rest)

  if (command === "inspect") {
    assertKnownFlags(flags, new Set(["bypass-user", "json"]))
    const report = buildInspectReport(owner, repo, flagString(flags, "bypass-user", DEFAULT_BYPASS_LOGIN))
    if (flagBoolean(flags, "json")) {
      console.log(JSON.stringify(report, null, 2))
    } else {
      printInspectReport(report)
    }
  } else if (command === "apply") {
    assertKnownFlags(
      flags,
      new Set([
        "bypass-user",
        "status-checks",
        "overwrite-ruleset",
        "overwrite-codeowners",
        "skip-ruleset",
        "skip-codeowners",
        "skip-auto-merge",
      ]),
    )
    await apply(owner, repo, flags)
  } else {
    usageAndExit()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
