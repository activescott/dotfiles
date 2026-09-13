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
  workflow_runs: Array<{ id: number; name: string | null }>
}

interface WorkflowJobsResponse {
  jobs: Array<{ name: string }>
}

/** Maps job name -> parent workflow name, for every Actions workflow run against this commit. */
function buildJobToWorkflowNameMap(owner: string, repo: string, sha: string): Map<string, string> {
  const jobToWorkflowName = new Map<string, string>()
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
      jobToWorkflowName.set(job.name, run.name)
    }
  }
  return jobToWorkflowName
}

/**
 * Enumerates status-check contexts actually observed on the default branch's tip commit.
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

  const jobToWorkflowName = buildJobToWorkflowNameMap(owner, repo, commit.sha)
  for (const run of runs) {
    const workflowName = jobToWorkflowName.get(run.name)
    const label = workflowName ? `${workflowName} / ${run.name}` : run.name
    checks.set(run.name, { context: run.name, label })
  }

  return Array.from(checks.values())
}
