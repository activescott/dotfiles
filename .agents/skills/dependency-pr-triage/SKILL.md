---
name: dependency-pr-triage
description: Triage open dependency-update PRs (Dependabot or Renovate) in a GitHub repo — rebase/recreate stale, verify the update will actually take effect, merge one at a time, verify it landed. Covers both CI/lockfile code repos and CI-less GitOps repos (Flux/k8s) where "did it work" means reconcile + pod health, not a green check. Trigger: asked to clean up/triage/merge Dependabot or Renovate PRs, or repo has a pile of open `dependabot/...` / `renovate/...` branches.
---

# Dependency PR triage

Batch process open Dependabot or Renovate PRs. Two things vary per repo and must be
established before touching any PR:

1. **Which bot** — Dependabot and Renovate have different merge/rebase mechanics (below).
2. **How "it worked" is verified** — a CI/lockfile code repo proves success with green
   checks + a release; a GitOps repo (no CI) proves success by watching Flux reconcile
   and the affected workload come back healthy. Same core loop, different verify step.

Read the repo's own dependency-update policy first if one exists (e.g. an `AGENTS.md`
tiering doc: what flows freely vs needs opt-in approval vs is never proposed). That
policy — not this skill — decides whether a given PR is safe to merge unattended.

## Core rule: one PR at a time, full cycle, no batching

**No** mass-rebase or mass-merge across many PRs then work through results.

In a CI/lockfile repo this is forced by the shared lockfile: one merge changes it,
flips **every other open PR** clean → conflicting.

In a GitOps repo there's no lockfile to conflict, but one-at-a-time still applies —
per this repo's own policy example: "merge one at a time; wait for the affected app
to come back healthy before the next." Reason: watching each rollout individually is
the only way to know *which* merge caused a regression, and to catch an unrelated
pre-existing blocker (see the GitOps gotcha below) before it gets blamed on the PR
you just merged.

Loop, per PR:

1. Check `mergeable` / review-and-check status (⚠️ "blocked" means different things
   per repo type — see each section below).
2. Conflicting → rebase (bot-specific, below).
3. Clean → verify the update will actually take effect once merged (bot- and
   repo-type-specific, below).
4. Merge (bot-specific, below).
5. **Verify it actually landed** (repo-type-specific, below) — not just that the
   merge succeeded.
6. Re-list all open PRs — merging one can close/supersede/combine others.
7. **Only then** next PR.

```sh
gh pr list --repo <owner>/<repo> --state open --author "app/dependabot" \
  --json number,title,mergeable,mergeStateStatus
# Renovate's bot login is app/renovate
gh pr list --repo <owner>/<repo> --state open --author "app/renovate" \
  --json number,title,mergeable,mergeStateStatus
```

## Bot mechanics: Dependabot vs Renovate

### Dependabot

Merge via comment, not `gh pr merge` — Dependabot handles wait-for-checks + retry:

- `@dependabot merge` — merge once checks pass (repo default merge method)
- `@dependabot squash and merge` — force squash
- `@dependabot rebase` — pull latest target branch into PR branch
- `@dependabot recreate` — close + reopen as a **fresh** PR against current default
  branch, regenerating the whole lockfile. Use over `rebase` when checks fail for
  reasons unrelated to the bumped dep (e.g. lockfile drift from later root
  `package.json` changes) — plain rebase only replays the target-branch merge and
  won't regenerate a drifted lockfile.
- `@dependabot close` — abandon (won't reopen for that version)

Watch for: **`Superseded by #N`** (old PR dead, track `#N`); combined bumps on
`recreate` (PR numbers shift — always re-list); auto-close with "these dependencies
are updatable in another way" (check for a replacement PR before concluding the dep
is unhandled).

### Renovate

No comment-triggered merge — merge with `gh pr merge` (or `gh pr review --approve`
first if the repo requires review, per its branch protection). For ongoing
automation, configure `automerge` in `renovate.json5` per the repo's own tiering
policy rather than merging by hand every time.

To force a rebase: check the PR's "rebase/retry" checkbox in the PR body (via the
GitHub UI, or `gh pr edit --add-label`/body edit), or use the repo's **Dependency
Dashboard** issue if enabled — it has one checkbox per held/failing PR (rebase,
recreate, or approve a major gated by `dependencyDashboardApproval`).

Renovate PRs are grouped/tiered by `packageRules` in `renovate.json5` — read that
file before triaging so you know which PRs are meant to be quick approvals vs
majors deliberately held for a human decision.

## Verify the update will actually take effect

### CI/lockfile code repos (npm/yarn/pnpm + conventional-commit releases)

Do this **before** trusting any merged PR — two silent failure modes (merge
succeeds, no error):

1. **Wrong scope.** Dependabot/Renovate's auto-detected commit scope is generic
   (`deps`/`deps-dev`), but semantic-release-style tooling in a monorepo matches
   scope to package/workspace name. A generic scope never gets attributed to the
   package it actually bumped, even though the bump touched that package's
   `package.json`.
2. **Wrong type.** Auto-detected type is usually `chore`. If the release tooling
   treats `chore` as no-release (common — only `fix`/`feat` cut a release), the
   bump — including future security fixes — merges but **never publishes**.

```sh
# Which workspace package.json files does this bump actually touch?
git show <merge-commit-sha> --stat | grep package.json

# Does the commit's scope match one of those package directory names,
# and is the commitlint scope-enum (if any) satisfied?
cat commitlint.config.js   # look for scope-enum
```

If a bump touches a real published workspace package but arrives as
`chore(deps): ...`, it ships unreleased. No auto-fix mid-triage — flag to the user:
add `.github/dependabot.yml` (or Renovate's `commitMessage*` options) with a
per-package `commit-message.prefix` matching that package's scope. Never pick
`fix` vs `chore` yourself — that's a release-policy call; ask.

Bumps touching only **transitive** deps (not in any workspace `package.json`
directly) are safe — no package to release, generic scope is harmless.

#### Sibling packages that must move together

Some ecosystems ship package families needing matched versions — framework core +
dev/build/server companions, client + codegen/CLI. The bot moves one dep at a time;
there's no "these N move together" notion. CI stays green (build/typecheck/e2e all
pass against whatever versions are in the tree) — mismatch is quietly unsupported,
caught only by a later manual audit or a runtime failure.

```sh
# list other deps from the same publisher/scope as the one just bumped
grep -E '"@<scope>/' package.json
```

Skim ecosystem release notes for "upgrade together" / peer-version language before
merging a package with known siblings.

#### Environment protection approvals can block e2e_tests (or equivalent)

A workflow `environment:` step can put a check in "WAITING" (blocked on approval,
distinct from "PENDING" = queued). Detect and approve:

```sh
gh pr view <pr> --repo <owner>/<repo> --json statusCheckRollup \
  -q '.statusCheckRollup[] | select(.name == "<job-name>") | .status'
job_url=$(gh pr view <pr> --repo <owner>/<repo> --json statusCheckRollup \
  -q '.statusCheckRollup[] | select(.name == "<job-name>") | .detailsUrl' | head -1)
run_id=$(echo "$job_url" | sed 's|.*/runs/\([0-9]*\)/.*|\1|')
gh api repos/<owner>/<repo>/actions/runs/$run_id/pending_deployments -q 'length'
gh api repos/<owner>/<repo>/actions/runs/$run_id/pending_deployments -X POST --input - <<'EOF'
{ "environment_ids": [<env-id>], "state": "approved", "comment": "Approved for testing" }
EOF
```

If the workflow has `concurrency: group: <target-branch>`, only one PR at a time
can hold the approval slot — approve one, let it run, then the next PR's approval
appears.

#### Lockfile regen can itself be broken

Seen: `npm ci` fails CI with `EUSAGE` / `Missing: <pkg>@<version> from lock file`,
looks like ordinary drift, but the **same error persists after `recreate`** against
current default branch. Root cause was the bot's own lockfile generator (dropped
`"dev": true` flags, omitted top-level entries for transitive deps). Confirm in an
isolated worktree, not the primary checkout:

```sh
git worktree add /tmp/<repo>-lockcheck origin/<bot-branch> -q
cd /tmp/<repo>-lockcheck && npm ci   # reproduces the error locally
```

Fix by regenerating with plain `npm install`, then push to the bot's PR branch —
confirm with the user first, this is a real push to a shared/visible branch:

```sh
npm install --package-lock-only --ignore-scripts
git diff --stat package-lock.json   # sanity check: only lockfile entries
rm -rf node_modules && npm ci --ignore-scripts
git add package-lock.json && git commit -S -m "fix: repair lockfile drift left by bot regen"
git push origin HEAD:<bot-branch-name>
```

Multiple PRs with the same symptom in one session → same repo-level lockfile issue,
not per-PR — same fix each, still one-PR-at-a-time.

### GitOps / no-CI repos (Flux, Argo CD, plain-manifest repos)

There's no build, no lockfile, no release to trigger — "the update took effect"
means the cluster's reconciler applied it and the workload is healthy. Concretely,
for Flux:

#### `mergeStateStatus: BLOCKED` may just mean "needs review," not "tests failed"

If the repo has no CI pipeline, `statusCheckRollup` is empty and the block is
`reviewDecision: REVIEW_REQUIRED` from branch protection, not a failing check.
Check both explicitly — don't assume BLOCKED means broken:

```sh
gh pr view <pr> --repo <owner>/<repo> --json statusCheckRollup,reviewDecision
```

#### Verify by watching Flux, not by reading a check mark

After merge: confirm the `GitRepository` source picked up the commit, then the
relevant `Kustomization`/`HelmRelease` reconciled to it, then the pod is healthy.

```sh
flux --context <ctx> get sources git flux-system          # confirms commit synced
flux --context <ctx> get kustomization <name>              # one name per call — see gotcha below
flux --context <ctx> get helmrelease <name> -n <namespace>
kubectl --context <ctx> -n <namespace> get pods
```

⚠️ **`flux get kustomization`/`get helmrelease` silently ignores extra positional
names** — `flux get kustomizations a b` only ever returns `a`. Check each resource
in its own call, not a combined one, or you'll get a false "still not ready" read
on the resource that was silently dropped.

⚠️ **A HelmRelease's `REVISION` column is the chart version, not a git SHA** — don't
grep HelmRelease output for a commit hash to detect rollout; match against the new
chart/app version instead, and use `flux get sources git` separately to confirm the
git commit itself synced.

⚠️ **A merge can be correct in git yet invisible in the cluster** if something
*else* is already blocking the kustomization tree — a pre-existing unrelated
failure (e.g. an orphaned `ImagePolicy` for a decommissioned app failing its health
check) can wedge the entire dependency chain so nothing downstream reconciles,
including the PR you just merged. Before troubleshooting the PR, check the whole
tree for anything already unhealthy:

```sh
flux --context <ctx> get kustomizations   # full tree — look for pre-existing failures
```

If found, that's a separate incident — fix it (as its own commit, GitOps-only, no
out-of-band cluster edits) before concluding anything about the dependency PRs.

⚠️ **Stage every file the fix touches.** Removing a resource file but forgetting to
`git add` the edit to its parent `kustomization.yaml`'s resource list produces a
commit that deletes the file while the list still references it — kustomize build
fails on the next reconcile. Run `git status --short` right before committing and
confirm every changed path shows a staged status (no leading space in the `XY`
column), not just the ones you remember editing.

#### Sibling resources that must move together (GitOps analog of sibling packages)

Same failure shape as npm sibling packages: a chart major can require companion
resources to move in lockstep (e.g. a Grafana major that also needs its plugin
version pins bumped in the same change) with nothing in the repo enforcing it.
Check the target app's own docs for this before merging a major.

#### App-specific care

Check the repo's own policy doc for per-app rules (e.g. "stateful app with
forward-only migrations: skim breaking-change notes, take a snapshot/backup first,
merge in an attended window"). Grep the target app's config for the integrations/
features actually in use and cross-reference against the upstream release's
breaking-change notes — most breaking changes won't apply to a minimal config.

## Use a worktree for local investigation

Need to reproduce a CI failure locally (e.g. confirm an `npm ci` lockfile-drift
error) without disturbing another session's use of the primary working dir:

```sh
git worktree add ../<repo>-worktrees/dependency-triage -b chore/dependency-triage origin/<default-branch>
```
