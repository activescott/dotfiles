import { spawnSync } from "node:child_process"
import { ghApiJsonOrNull } from "./gh.mts"

export interface AvailableCheck {
  /** The real required-status-check value — a check-run name, e.g. "kustomize-build". */
  context: string
  /** Display-only. "<workflow name> / <job name>" for Actions checks, matching what GitHub
   *  shows on a PR; falls back to `context` when the workflow name can't be resolved (e.g. a
   *  non-Actions check-run, or an Actions run whose jobs API lookup failed). */
  label: string
}

interface CommitResponse {
  sha: string
}

interface CheckRunsResponse {
  check_runs: Array<{ name: string }>
}

interface WorkflowRunsResponse {
  workflow_runs: Array<{ id: number; name: string | null; path: string }>
}

interface WorkflowJobsResponse {
  jobs: Array<{ name: string }>
}

interface JobMetadata {
  /** Parent workflow's declared name, e.g. "doctor-lint". */
  workflowName: string
  /** Workflow file path, e.g. ".github/workflows/doctor-lint.yaml" — used to check its `on:` triggers. */
  path: string
}

/** Maps job name -> parent workflow metadata, for every Actions workflow run against this commit. */
function buildJobMetadataMap(owner: string, repo: string, sha: string): Map<string, JobMetadata> {
  const jobMetadata = new Map<string, JobMetadata>()
  const runsResponse = ghApiJsonOrNull<WorkflowRunsResponse>([
    `repos/${owner}/${repo}/actions/runs`,
    "-X",
    "GET",
    "-f",
    `head_sha=${sha}`,
  ])
  for (const run of runsResponse?.workflow_runs ?? []) {
    if (!run.name) {
      continue
    }
    const jobsResponse = ghApiJsonOrNull<WorkflowJobsResponse>([
      `repos/${owner}/${repo}/actions/runs/${run.id}/jobs`,
    ])
    for (const job of jobsResponse?.jobs ?? []) {
      jobMetadata.set(job.name, { workflowName: run.name, path: run.path })
    }
  }
  return jobMetadata
}

interface ContentResponse {
  content: string
  encoding: string
}

/** Fetches a workflow file's `on:` trigger names (e.g. ["push", "pull_request"]) at `ref`. */
function fetchWorkflowTriggers(owner: string, repo: string, path: string, ref: string): string[] | null {
  const contentResponse = ghApiJsonOrNull<ContentResponse>([
    `repos/${owner}/${repo}/contents/${path}`,
    "-X",
    "GET",
    "-f",
    `ref=${ref}`,
  ])
  if (!contentResponse || contentResponse.encoding !== "base64") {
    return null
  }
  const yaml = Buffer.from(contentResponse.content, "base64").toString("utf8")

  const result = spawnSync("yq", ["-o=json", ".on", "-"], { encoding: "utf8", input: yaml })
  if (result.status !== 0) {
    return null
  }
  try {
    const onValue: unknown = JSON.parse(result.stdout)
    if (typeof onValue === "string") {
      return [onValue]
    }
    if (Array.isArray(onValue)) {
      return onValue.filter((entry): entry is string => typeof entry === "string")
    }
    if (onValue && typeof onValue === "object") {
      return Object.keys(onValue)
    }
    return []
  } catch {
    return null
  }
}

/**
 * Whether a check-run's workflow can ever run against a pull request's head commit — i.e. its
 * `on:` includes `pull_request` or `pull_request_target`. A workflow triggered only by `push` /
 * `workflow_dispatch` / tags never reports a check-run against a PR, so requiring it would
 * permanently block every PR. Returns true (fail open) when the trigger list can't be determined,
 * so a lookup failure never silently hides an otherwise-valid check.
 */
function canRunOnPullRequest(
  owner: string,
  repo: string,
  path: string,
  defaultBranch: string,
  cache: Map<string, boolean>,
): boolean {
  const cached = cache.get(path)
  if (cached !== undefined) {
    return cached
  }
  const triggers = fetchWorkflowTriggers(owner, repo, path, defaultBranch)
  const result = triggers === null ? true : triggers.includes("pull_request") || triggers.includes("pull_request_target")
  cache.set(path, result)
  return result
}

/**
 * Enumerates status-check contexts actually observed on the default branch's tip commit.
 *
 * Excludes any Actions check-run whose workflow currently has no `pull_request` /
 * `pull_request_target` trigger (checked via `canRunOnPullRequest`): a `push`-only or
 * `workflow_dispatch`-only workflow never posts a check-run against a PR's head commit,
 * so requiring it would permanently block every PR even though it "was observed" here.
 *
 * Deliberately NOT sourced from the Actions workflows list
 * (`repos/{owner}/{repo}/actions/workflows`): a workflow's own declared name (e.g. "validate")
 * is never a valid `required_status_checks` context — GitHub matches on the check-run name of
 * the individual job (e.g. "kustomize-build"), which can differ completely from the workflow
 * name. Offering workflow names as candidates would let someone require a check that can never
 * be satisfied, permanently blocking merges. The workflow name is still resolved separately, for
 * display only, via the Actions runs/jobs APIs.
 */
export function listAvailableChecks(owner: string, repo: string, defaultBranch: string): AvailableCheck[] {
  const checks = new Map<string, AvailableCheck>()
  const pullRequestTriggerCache = new Map<string, boolean>()

  const commit = ghApiJsonOrNull<CommitResponse>([`repos/${owner}/${repo}/commits/${defaultBranch}`])
  if (!commit) {
    return []
  }

  const checkRuns = ghApiJsonOrNull<CheckRunsResponse>([
    `repos/${owner}/${repo}/commits/${commit.sha}/check-runs`,
  ])
  const runs = checkRuns?.check_runs ?? []
  if (runs.length === 0) {
    return []
  }

  const jobMetadata = buildJobMetadataMap(owner, repo, commit.sha)
  for (const run of runs) {
    const metadata = jobMetadata.get(run.name)
    if (metadata && !canRunOnPullRequest(owner, repo, metadata.path, defaultBranch, pullRequestTriggerCache)) {
      continue
    }
    const label = metadata ? `${metadata.workflowName} / ${run.name}` : run.name
    checks.set(run.name, { context: run.name, label })
  }

  return Array.from(checks.values())
}
