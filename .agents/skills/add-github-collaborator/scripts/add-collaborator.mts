#!/usr/bin/env -S node --experimental-strip-types
import { ghApi, ghApiJson, ghApiJsonOrNull } from "../../protect-github-repo/scripts/lib/gh.mts"
import { findExistingCodeowners } from "../../protect-github-repo/scripts/lib/codeowners.mts"
import { bold, dim, green, red } from "../../protect-github-repo/scripts/lib/color.mts"

const DEFAULT_CODEOWNER = "activescott"
const COLLABORATOR_PERMISSION = "push"

interface RepoInfo {
  default_branch: string
  permissions?: { admin?: boolean }
}

interface RulesetSummary {
  id: number
  name: string
  target: string
  enforcement: string
}

interface BranchProtection {
  required_pull_request_reviews?: { require_code_owner_reviews?: boolean }
}

function usageAndExit(): never {
  console.error(
    "usage: ./add-collaborator.mts <owner>/<repo> <github-username> [--codeowner <login>] [--check-only]",
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function getRepoInfo(owner: string, repo: string): RepoInfo {
  return ghApiJson<RepoInfo>([`repos/${owner}/${repo}`])
}

/** Codeowners lines are `<pattern> @owner1 @owner2 ...`; comments and blanks don't count. */
function codeownersNamesLogin(content: string, login: string): boolean {
  const needle = `@${login.toLowerCase()}`
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .some((line) => line.toLowerCase().split(/\s+/).includes(needle))
}

function findBranchRulesets(owner: string, repo: string): Array<Record<string, unknown>> {
  // --paginate follows every page; --slurp wraps the pages into an outer array (one sub-array
  // per page) rather than a flat list, hence the .flat().
  const pages = ghApiJson<RulesetSummary[][]>([`repos/${owner}/${repo}/rulesets`, "--paginate", "--slurp"])
  return pages
    .flat()
    .filter((summary) => summary.target === "branch")
    .map((summary) => ghApiJson<Record<string, unknown>>([`repos/${owner}/${repo}/rulesets/${summary.id}`]))
}

/** True if the ruleset is active, applies to the default branch, and requires a code-owner review to merge. */
function rulesetProtectsDefaultBranchWithCodeOwnerReview(
  ruleset: Record<string, unknown>,
  defaultBranch: string,
): boolean {
  if (ruleset.enforcement !== "active") {
    return false
  }
  const conditions = ruleset.conditions
  const refName = isRecord(conditions) ? conditions.ref_name : undefined
  const include = isRecord(refName) && Array.isArray(refName.include) ? refName.include : []
  const exclude = isRecord(refName) && Array.isArray(refName.exclude) ? refName.exclude : []
  const defaultBranchRef = `refs/heads/${defaultBranch}`
  const includesDefault = include.includes("~DEFAULT_BRANCH") || include.includes(defaultBranchRef)
  const excludesDefault = exclude.includes("~DEFAULT_BRANCH") || exclude.includes(defaultBranchRef)
  if (!includesDefault || excludesDefault) {
    return false
  }
  const rules = ruleset.rules
  if (!Array.isArray(rules)) {
    return false
  }
  return rules.some(
    (rule) =>
      isRecord(rule) &&
      rule.type === "pull_request" &&
      isRecord(rule.parameters) &&
      rule.parameters.require_code_owner_review === true,
  )
}

/** Classic (non-ruleset) branch protection, the older mechanism some repos still use instead of a ruleset. */
function classicProtectionRequiresCodeOwnerReview(owner: string, repo: string, defaultBranch: string): boolean {
  const protection = ghApiJsonOrNull<BranchProtection>([`repos/${owner}/${repo}/branches/${defaultBranch}/protection`])
  return protection?.required_pull_request_reviews?.require_code_owner_reviews === true
}

interface PreflightResult {
  codeownersOk: boolean
  codeownersDetail: string
  branchProtectionOk: boolean
  branchProtectionDetail: string
}

function runPreflight(owner: string, repo: string, defaultBranch: string, codeowner: string): PreflightResult {
  const existingCodeowners = findExistingCodeowners(owner, repo)
  const codeownersOk = existingCodeowners !== null && codeownersNamesLogin(existingCodeowners.content, codeowner)
  const codeownersDetail = !existingCodeowners
    ? "no CODEOWNERS file found"
    : codeownersOk
      ? `CODEOWNERS at ${existingCodeowners.path} names @${codeowner}`
      : `CODEOWNERS at ${existingCodeowners.path} does not name @${codeowner} as an owner`

  const rulesetHit = findBranchRulesets(owner, repo).find((ruleset) =>
    rulesetProtectsDefaultBranchWithCodeOwnerReview(ruleset, defaultBranch),
  )
  const branchProtectionOk =
    rulesetHit !== undefined || classicProtectionRequiresCodeOwnerReview(owner, repo, defaultBranch)
  const branchProtectionDetail = rulesetHit
    ? `ruleset "${String(rulesetHit.name)}" requires code-owner review on ${defaultBranch}`
    : branchProtectionOk
      ? `classic branch protection on ${defaultBranch} requires code-owner review`
      : `no active rule found on ${defaultBranch} requiring a code-owner review before merging`

  return { codeownersOk, codeownersDetail, branchProtectionOk, branchProtectionDetail }
}

function printPreflight(result: PreflightResult): void {
  console.log(bold("Preflight checks"))
  console.log(`  ${result.codeownersOk ? green("✔") : red("✘")} ${result.codeownersDetail}`)
  console.log(`  ${result.branchProtectionOk ? green("✔") : red("✘")} ${result.branchProtectionDetail}`)
}

function putCollaborator(owner: string, repo: string, login: string): void {
  const stdout = ghApi([
    `repos/${owner}/${repo}/collaborators/${login}`,
    "-X",
    "PUT",
    "-f",
    `permission=${COLLABORATOR_PERMISSION}`,
  ]).trim()
  if (stdout.length === 0) {
    console.log(
      `${green("✔")} ${login} already had repo access; permission set to "${COLLABORATOR_PERMISSION}" (no invite needed)`,
    )
    return
  }
  const invite = JSON.parse(stdout) as { invitee?: { login?: string }; permissions?: unknown; html_url?: string }
  console.log(
    `${green("✔")} invited ${invite.invitee?.login ?? login} with "${COLLABORATOR_PERMISSION}" permission — pending until they accept`,
  )
  if (invite.html_url) {
    console.log(`  ${dim(invite.html_url)}`)
  }
}

async function main(): Promise<void> {
  const [repoSpec, collaboratorLogin, ...rest] = process.argv.slice(2)
  if (!repoSpec || !collaboratorLogin) {
    usageAndExit()
  }
  const { owner, repo } = parseRepoSpec(repoSpec)

  let codeowner = DEFAULT_CODEOWNER
  let checkOnly = false
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]
    if (arg === "--codeowner") {
      const value = rest[i + 1]
      if (!value) {
        throw new Error("--codeowner requires a value")
      }
      codeowner = value
      i++
    } else if (arg === "--check-only") {
      checkOnly = true
    } else {
      throw new Error(`unknown flag ${String(arg)}`)
    }
  }

  const repoInfo = getRepoInfo(owner, repo)
  if (!repoInfo.permissions?.admin) {
    throw new Error(`current gh auth does not have admin on ${owner}/${repo}; cannot add a collaborator`)
  }

  console.log(
    `${bold(`${owner}/${repo}`)}  ${dim(`(default branch: ${repoInfo.default_branch}, codeowner checked: @${codeowner})`)}`,
  )
  console.log()

  const preflight = runPreflight(owner, repo, repoInfo.default_branch, codeowner)
  printPreflight(preflight)
  console.log()

  if (!preflight.codeownersOk || !preflight.branchProtectionOk) {
    console.log(
      `${red("✘")} refusing to add ${collaboratorLogin} — @${codeowner} must be a code owner and the default branch ` +
        "must require code-owner review before this repo can safely grant another collaborator merge access.",
    )
    console.log(dim("  see the protect-github-repo skill to set this up first"))
    process.exit(1)
  }

  if (checkOnly) {
    console.log(`${green("✔")} preflight passed — re-run without --check-only to add ${collaboratorLogin}`)
    return
  }

  putCollaborator(owner, repo, collaboratorLogin)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
