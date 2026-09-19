#!/usr/bin/env -S node --experimental-strip-types
import { Buffer } from "node:buffer"
import { readFileSync } from "node:fs"
import { basename } from "node:path"
import { ghApi, ghApiJson } from "./lib/gh.mts"
import {
  ALLOWED_MERGE_METHODS,
  RULESET_NAME,
  buildCanonicalRuleset,
  extractAllowedMergeMethods,
  extractRequiredStatusCheckContexts,
  hasDeployKeyBypassActor,
  rulesetCoreMatches,
  stripRulesetMetadata,
  withDeployKeyBypassActor,
  withoutAllowedMergeMethods,
  withoutDeployKeyBypassActor,
  withoutStatusChecksRule,
} from "./lib/ruleset.mts"
import type { MergeMethod } from "./lib/ruleset.mts"
import { buildCanonicalCodeowners, findExistingCodeowners } from "./lib/codeowners.mts"
import { listAvailableChecks } from "./lib/statusChecks.mts"
import type { AvailableCheck } from "./lib/statusChecks.mts"
import { addDeployKey, findDeployKeyByMaterial, listDeployKeys } from "./lib/deployKeys.mts"
import type { DeployKeySummary } from "./lib/deployKeys.mts"
import { listSecretNames, setSecretFromFile, setSecretFromValue } from "./lib/secrets.mts"
import { backupDirFor, writeBackup } from "./lib/backup.mts"
import { diffValues } from "./lib/diff.mts"
import type { DiffEntry } from "./lib/diff.mts"
import { bold, dim, green, red, yellow } from "./lib/color.mts"
import { confirmPrompt, multiselectPrompt, pastedSecretPrompt, textPrompt } from "./lib/prompt.mts"

const DEFAULT_BYPASS_LOGIN = "activescott"
const DEFAULT_DEPLOY_KEY_SECRET_NAME = "RELEASE_DEPLOY_KEY"
const DEFAULT_ALLOWED_MERGE_METHODS: MergeMethod[] = ["squash"]

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
        "[--merge-methods <comma-list of merge,squash,rebase>] " +
        "[--bypass-user <login>] [--overwrite-ruleset] [--overwrite-codeowners] " +
        "[--skip-ruleset] [--skip-codeowners] [--skip-auto-merge] " +
        "[(--deploy-key <public-key-value> | --deploy-key-file <path>) [--deploy-key-title <title>] " +
        "| --skip-deploy-key] " +
        "[--deploy-key-private-key-file <path> [--deploy-key-secret-name <name>] | --skip-deploy-key-secret]",
      "    omitted --status-checks / --merge-methods / --overwrite-* / --skip-* fall back to an " +
        "interactive prompt (requires a TTY); --merge-methods defaults to squash-only when accepted",
      "    omitted --deploy-key / --deploy-key-file / --skip-deploy-key: on a TTY, prompts " +
        "whether to add one (accepts a pasted key or a file path); otherwise leaves deploy-key " +
        "bypass untouched (no prompt, no error)",
      "    omitted --deploy-key-private-key-file / --skip-deploy-key-secret: on a TTY, prompts " +
        `whether to also store the matching private key as a secret (default name ` +
        `"${DEFAULT_DEPLOY_KEY_SECRET_NAME}") in both Actions and Dependabot; otherwise leaves ` +
        "secrets untouched (no prompt, no error)",
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
  "skip-deploy-key",
  "skip-deploy-key-secret",
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
  currentAllowedMergeMethods: string[] | null
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
  deployKeyBypass: { rulesetAllows: boolean; writeAccessKeys: DeployKeySummary[] }
  secrets: { actions: string[]; dependabot: string[] }
}

function buildInspectReport(owner: string, repo: string, bypassLogin: string): InspectReport {
  const repoInfo = getRepoInfo(owner, repo)
  const bypassUserId = resolveUserId(bypassLogin)
  const canonical = buildCanonicalRuleset({
    bypassUserId,
    requiredStatusCheckContexts: [],
    allowedMergeMethods: DEFAULT_ALLOWED_MERGE_METHODS,
  })

  const rulesets = findBranchRulesets(owner, repo).map((ruleset) => {
    const core = withoutAllowedMergeMethods(
      withoutDeployKeyBypassActor(withoutStatusChecksRule(stripRulesetMetadata(ruleset))),
    )
    return {
      id: typeof ruleset.id === "number" ? ruleset.id : null,
      name: typeof ruleset.name === "string" ? ruleset.name : "",
      coreMatchesCanonical: rulesetCoreMatches(ruleset, canonical),
      currentRequiredStatusChecks: extractRequiredStatusCheckContexts(ruleset),
      currentAllowedMergeMethods: extractAllowedMergeMethods(ruleset),
      diff: diffValues(withoutAllowedMergeMethods(canonical), core),
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

  const namedRuleset = rulesets.find((ruleset) => ruleset.name === RULESET_NAME)

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
    deployKeyBypass: {
      rulesetAllows: namedRuleset !== undefined && hasDeployKeyBypassActor(namedRuleset.raw),
      writeAccessKeys: listDeployKeys(owner, repo).filter((key) => !key.read_only),
    },
    secrets: {
      actions: listSecretNames(owner, repo, "actions"),
      dependabot: listSecretNames(owner, repo, "dependabot"),
    },
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
  const {
    repo,
    rulesets,
    codeowners,
    canonicalCodeownersPreview,
    availableStatusChecks,
    autoMerge,
    deployKeyBypass,
    secrets,
  } = report

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
  const currentMergeMethods = named ? named.currentAllowedMergeMethods : []
  console.log(
    `  ${dim("○")} allowed merge methods: ${
      currentMergeMethods === null ? "all (unset)" : currentMergeMethods.join(", ") || "(none)"
    }`,
  )
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
  console.log(bold("Deploy-key bypass"))
  if (deployKeyBypass.rulesetAllows) {
    console.log(`  ${green("✔")} ruleset allows any write-access deploy key to bypass`)
  } else {
    console.log(`  ${dim("○")} not enabled — pass --deploy-key-file to add one`)
  }
  if (deployKeyBypass.writeAccessKeys.length > 0) {
    for (const key of deployKeyBypass.writeAccessKeys) {
      console.log(`      write-access deploy key: "${key.title}" (id ${key.id})`)
    }
  } else if (deployKeyBypass.rulesetAllows) {
    console.log(`      ${yellow("⚠")} no write-access deploy key on the repo yet — the bypass has nothing to apply to`)
  }

  console.log()
  console.log(bold("Secrets (names only — values are never fetched)"))
  console.log(`  Actions:    ${secrets.actions.length > 0 ? secrets.actions.join(", ") : dim("none")}`)
  console.log(`  Dependabot: ${secrets.dependabot.length > 0 ? secrets.dependabot.join(", ") : dim("none")}`)

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

function parseMergeMethods(rawValue: string): MergeMethod[] {
  const methods = [
    ...new Set(
      rawValue
        .split(",")
        .map((method) => method.trim())
        .filter((method) => method.length > 0),
    ),
  ]
  for (const method of methods) {
    if (!ALLOWED_MERGE_METHODS.includes(method as MergeMethod)) {
      throw new Error(`--merge-methods: "${method}" is not one of ${ALLOWED_MERGE_METHODS.join(", ")}`)
    }
  }
  if (methods.length === 0) {
    throw new Error("--merge-methods requires at least one of " + ALLOWED_MERGE_METHODS.join(", "))
  }
  return methods as MergeMethod[]
}

async function resolveAllowedMergeMethods(flags: Flags): Promise<MergeMethod[]> {
  const mergeMethodsFlag = flags.get("merge-methods")
  if (mergeMethodsFlag !== undefined) {
    if (typeof mergeMethodsFlag !== "string") {
      throw new Error(`--merge-methods requires a value: a comma-separated list of ${ALLOWED_MERGE_METHODS.join(", ")}`)
    }
    return parseMergeMethods(mergeMethodsFlag)
  }
  const selected = await multiselectPrompt(
    "Which merge methods should the merge button offer?",
    ALLOWED_MERGE_METHODS.map((method) => ({ label: method, value: method, selected: method === "squash" })),
    { flagHint: "--merge-methods", zeroIsFine: false },
  )
  if (selected.length === 0) {
    throw new Error(`must allow at least one merge method (${ALLOWED_MERGE_METHODS.join(", ")})`)
  }
  return selected as MergeMethod[]
}

interface DeployKeyRequest {
  publicKey: string
  title: string
}

/** SSH public-key line prefixes, e.g. "ssh-ed25519 AAAA... comment" or "ecdsa-sha2-nistp256 AAAA...". */
const PUBLIC_KEY_PATTERN = /^(ssh-(rsa|ed25519|dss)|ecdsa-sha2-\S+|sk-(ssh-ed25519|ecdsa-sha2-nistp256)@openssh\.com)\s+\S/

function looksLikePublicKey(value: string): boolean {
  return PUBLIC_KEY_PATTERN.test(value.trim())
}

/** Resolves user input that's either the public key pasted directly, or a path to a file containing it. */
function resolveDeployKeyMaterial(input: string): string {
  const trimmed = input.trim()
  if (looksLikePublicKey(trimmed)) {
    return trimmed
  }
  return readFileSync(trimmed, "utf8").trim()
}

/** For a pasted key, its trailing comment (e.g. "release@fernfiles"); for a file path, the basename. */
function defaultDeployKeyTitle(input: string): string {
  const trimmed = input.trim()
  if (looksLikePublicKey(trimmed)) {
    const [, , comment] = trimmed.split(/\s+/)
    return comment ?? "deploy-key"
  }
  return basename(trimmed).replace(/\.pub$/, "")
}

/**
 * Deploy-key bypass is opt-in and additive (see withDeployKeyBypassActor), unlike the other
 * apply() decisions — so unlike resolveRequiredStatusCheckContexts, an omitted flag on a
 * non-interactive run means "leave it untouched" rather than "fail fast" or "turn it off".
 */
async function resolveDeployKeyBypass(flags: Flags): Promise<DeployKeyRequest | null> {
  if (flagBoolean(flags, "skip-deploy-key")) {
    return null
  }
  const fileFlag = flags.get("deploy-key-file")
  const keyFlag = flags.get("deploy-key")
  if (typeof fileFlag === "string" && typeof keyFlag === "string") {
    throw new Error("pass only one of --deploy-key-file or --deploy-key, not both")
  }
  const flagInput = typeof keyFlag === "string" ? keyFlag : typeof fileFlag === "string" ? fileFlag : undefined
  if (flagInput !== undefined) {
    return {
      publicKey: resolveDeployKeyMaterial(flagInput),
      title: flagString(flags, "deploy-key-title", defaultDeployKeyTitle(flagInput)),
    }
  }
  if (!process.stdin.isTTY) {
    return null
  }
  const wantsOne = await confirmPrompt(
    "Add an SSH deploy key with write access as a ruleset bypass actor (e.g. so a CI job can push past the PR requirement)?",
  )
  if (!wantsOne) {
    return null
  }
  const input = await textPrompt(
    "Public key — must be a unique key generated just for this repo (GitHub rejects a key " +
      "already registered as a deploy key elsewhere, or as anyone's personal account key). " +
      "Paste it directly, or a path to a file containing it:",
  )
  const title = await textPrompt("Deploy key title:", { initial: defaultDeployKeyTitle(input) })
  return { publicKey: resolveDeployKeyMaterial(input), title }
}

type DeploySecretRequest = { secretName: string } & ({ source: "file"; path: string } | { source: "value"; value: string })

/**
 * Mirrors resolveDeployKeyBypass's "opt-in, untouched-by-default" shape: an omitted flag on
 * non-interactive stdin leaves secrets alone rather than failing fast, since most `apply` runs
 * don't need this.
 *
 * The flag path only ever accepts a file path — never a literal value — because a CLI argument is
 * visible in `ps`/argv and gets written to shell history; no amount of masking fixes that. The
 * interactive prompt is different: it explicitly asks whether you're pasting or pointing at a
 * file, and a paste goes through pastedSecretPrompt (echo fully suppressed, multi-line safe), so
 * a key that only ever lives in a password manager never has to touch disk.
 */
async function resolveDeploySecretRequest(flags: Flags): Promise<DeploySecretRequest | null> {
  if (flagBoolean(flags, "skip-deploy-key-secret")) {
    return null
  }
  const fileFlag = flags.get("deploy-key-private-key-file")
  if (typeof fileFlag === "string") {
    return {
      source: "file",
      path: fileFlag,
      secretName: flagString(flags, "deploy-key-secret-name", DEFAULT_DEPLOY_KEY_SECRET_NAME),
    }
  }
  if (!process.stdin.isTTY) {
    return null
  }
  const wantsOne = await confirmPrompt(
    `Also store the matching private key as a secret (Actions + Dependabot) named "${DEFAULT_DEPLOY_KEY_SECRET_NAME}" by default?`,
  )
  if (!wantsOne) {
    return null
  }
  const secretName = await textPrompt("Secret name:", { initial: DEFAULT_DEPLOY_KEY_SECRET_NAME })
  const wantsPaste = await confirmPrompt("Paste the private key value directly (instead of pointing at a file)?")
  if (wantsPaste) {
    const value = await pastedSecretPrompt(
      "Paste the private key now — input is hidden. It stops automatically at the key's own " +
        '"-----END ... PRIVATE KEY-----" line, or press Ctrl+D when done:',
    )
    return { source: "value", value, secretName }
  }
  const privateKeyFile = await textPrompt("Path to the private key file:")
  return { source: "file", path: privateKeyFile, secretName }
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
  const allowedMergeMethods = flagBoolean(flags, "skip-ruleset") ? [] : await resolveAllowedMergeMethods(flags)
  const canonical = buildCanonicalRuleset({ bypassUserId, requiredStatusCheckContexts, allowedMergeMethods })
  const canonicalWithoutStatusChecks = buildCanonicalRuleset({
    bypassUserId,
    requiredStatusCheckContexts: [],
    allowedMergeMethods,
  })
  const backupDir = backupDirFor(owner, repo)

  const deployKeyRequest = await resolveDeployKeyBypass(flags)
  if (deployKeyRequest && flagBoolean(flags, "skip-ruleset")) {
    throw new Error(
      "--deploy-key-file/deploy-key prompt requires the ruleset (bypass actors live on it) — remove --skip-ruleset or pass --skip-deploy-key",
    )
  }

  let rulesetId: number | null = null

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
      rulesetId = typeof named.id === "number" ? named.id : null
      const coreMatches = rulesetCoreMatches(named, canonicalWithoutStatusChecks)
      const checksMatch =
        JSON.stringify(extractRequiredStatusCheckContexts(named).slice().sort()) ===
        JSON.stringify(requiredStatusCheckContexts.slice().sort())
      const mergeMethodsMatch =
        JSON.stringify((extractAllowedMergeMethods(named) ?? []).slice().sort()) ===
        JSON.stringify(allowedMergeMethods.slice().sort())
      if (coreMatches && checksMatch && mergeMethodsMatch) {
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
      const created = ghApiJson<{ id: number }>(
        [`repos/${owner}/${repo}/rulesets`, "-X", "POST", "--input", "-"],
        JSON.stringify(canonical),
      )
      rulesetId = created.id
      console.log(`created ruleset "${RULESET_NAME}"`)
    }
  }

  if (deployKeyRequest) {
    const publicKey = deployKeyRequest.publicKey
    const existingKey = findDeployKeyByMaterial(owner, repo, publicKey)
    if (existingKey?.read_only) {
      throw new Error(
        `deploy key "${existingKey.title}" (id ${existingKey.id}) already exists on ${owner}/${repo} as read-only; ` +
          "remove it or add a different key so it can have write access",
      )
    }
    if (existingKey) {
      console.log(`deploy key "${existingKey.title}" (id ${existingKey.id}) already present with write access`)
    } else {
      let created: DeployKeySummary
      try {
        created = addDeployKey(owner, repo, deployKeyRequest.title, publicKey)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (message.includes("key is already in use")) {
          throw new Error(
            `GitHub rejected this key: "key is already in use". Did you use a unique key? It is ` +
              "important that every repo's deploy key is its own dedicated keypair — GitHub " +
              "rejects a key that's already registered as a deploy key on another repo, or that " +
              "matches anyone's personal account SSH key. Generate a fresh keypair for this repo " +
              `(e.g. \`ssh-keygen -t ed25519 -f ./deploy-key -C "release@${repo}" -N ""\`) and ` +
              "retry with that one.",
          )
        }
        throw error
      }
      console.log(`added deploy key "${created.title}" (id ${created.id}) with write access`)
    }

    if (rulesetId === null) {
      console.log(`no "${RULESET_NAME}" ruleset id available — skipping bypass actor`)
    } else {
      const current = ghApiJson<Record<string, unknown>>([`repos/${owner}/${repo}/rulesets/${String(rulesetId)}`])
      if (hasDeployKeyBypassActor(current)) {
        console.log(`ruleset "${RULESET_NAME}" already allows deploy-key bypass; no change`)
      } else {
        ghApi(
          [`repos/${owner}/${repo}/rulesets/${String(rulesetId)}`, "-X", "PUT", "--input", "-"],
          JSON.stringify(withDeployKeyBypassActor(stripRulesetMetadata(current))),
        )
        console.log(`added deploy-key bypass actor to ruleset "${RULESET_NAME}"`)
      }
    }
  }

  const deploySecretRequest = await resolveDeploySecretRequest(flags)
  if (deploySecretRequest) {
    const { secretName } = deploySecretRequest
    const setSecret = (app: "actions" | "dependabot"): void =>
      deploySecretRequest.source === "file"
        ? setSecretFromFile(owner, repo, secretName, deploySecretRequest.path, app)
        : setSecretFromValue(owner, repo, secretName, deploySecretRequest.value, app)
    setSecret("actions")
    console.log(`set Actions secret "${secretName}"`)
    setSecret("dependabot")
    console.log(`set Dependabot secret "${secretName}"`)
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
        "merge-methods",
        "overwrite-ruleset",
        "overwrite-codeowners",
        "skip-ruleset",
        "skip-codeowners",
        "skip-auto-merge",
        "deploy-key",
        "deploy-key-file",
        "deploy-key-title",
        "skip-deploy-key",
        "deploy-key-private-key-file",
        "deploy-key-secret-name",
        "skip-deploy-key-secret",
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
