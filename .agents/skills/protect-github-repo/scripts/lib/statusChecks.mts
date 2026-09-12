import { ghApiJsonOrNull } from "./gh.mts"

export interface AvailableCheck {
  context: string
  source: "workflow" | "check-run"
}

interface WorkflowsResponse {
  workflows: Array<{ name: string; state: string }>
}

interface CommitResponse {
  sha: string
}

interface CheckRunsResponse {
  check_runs: Array<{ name: string }>
}

/**
 * Enumerates status-check contexts observed on the repo: GitHub Actions
 * workflow names, plus actual check-run names seen on the default branch's
 * tip commit (covers external CI and per-job check names that don't match
 * the workflow file name).
 */
export function listAvailableChecks(owner: string, repo: string, defaultBranch: string): AvailableCheck[] {
  const checks = new Map<string, AvailableCheck>()

  const workflows = ghApiJsonOrNull<WorkflowsResponse>([`repos/${owner}/${repo}/actions/workflows`])
  for (const workflow of workflows?.workflows ?? []) {
    if (workflow.state === "active") {
      checks.set(workflow.name, { context: workflow.name, source: "workflow" })
    }
  }

  const commit = ghApiJsonOrNull<CommitResponse>([`repos/${owner}/${repo}/commits/${defaultBranch}`])
  if (commit) {
    const checkRuns = ghApiJsonOrNull<CheckRunsResponse>([
      `repos/${owner}/${repo}/commits/${commit.sha}/check-runs`,
    ])
    for (const run of checkRuns?.check_runs ?? []) {
      if (!checks.has(run.name)) {
        checks.set(run.name, { context: run.name, source: "check-run" })
      }
    }
  }

  return Array.from(checks.values())
}
