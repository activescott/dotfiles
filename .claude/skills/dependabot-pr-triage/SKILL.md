---
name: dependabot-pr-triage
description: Triage open Dependabot PRs in GitHub repo — rebase/recreate stale ones, verify trigger right release under repo's commit-message conventions, merge via Dependabot itself not manual. Trigger: asked to clean up, triage, merge Dependabot PRs, or repo has pile open `dependabot/...` branches.
---

# Dependabot PR triage

Process for working thru batch open Dependabot PRs in repo w/ shared lockfile (npm/yarn/pnpm workspaces) + conventional-commit-driven releases (e.g. semantic-release-style tooling). Learned real triage session, monorepo w/ per-package independent versioning.

## ⚠️ Before merging ANYTHING: verify commit triggers right release

Do first, before touch single PR — changes how merge every PR in batch, not just one.

Read repo's release-process docs (usually `README.md`) + commitlint config (`commitlint.config.js` or similar) **before** assume merged Dependabot PR does what expect. Two failure modes seen practice, both silent (merge succeeds; nothing errors):

1. **Wrong scope.** Dependabot's built-in conventional-commit auto-detection (used when no `.github/dependabot.yml` commit-message config) infers style from repo's last ~20 commits but always emit generic scope: `deps` for prod deps, `deps-dev` for dev deps. If repo's release tooling walk commits **per package** by matching commit scope to package/workspace name (e.g. `auth-provider-email`, `auth-adapter-react-router`), `deps`-scoped commit never attributed to package it actually changed — even tho really did bump that package's `package.json`.
2. **Wrong type.** Dependabot's auto-detected type always `chore`. If repo's version-bump rules treat `chore` as "no release" (common in Conventional-Commits-driven semantic release setups — only `fix`/`feat` cut release), dependency bumps — incl future security-fix bumps — merge into package's source but **never publish**, since nothing compute version bump for them.

How check if given PR affected:

```sh
# Which workspace package.json files does this bump actually touch?
git show <merge-commit-sha> --stat | grep package.json

# Does the commit's scope match one of those package directory names,
# and is the commitlint scope-enum (if any) satisfied?
cat commitlint.config.js   # look for scope-enum
```

If bump touches real, published workspace package but arrives as `chore(deps): ...` / `chore(deps-dev): ...`, ships silently un-released. This *not* auto bug to fix mid-triage — usually repo-level gap, flag to user: add `.github/dependabot.yml` w/ one `updates` entry per package `directory`, each w/ `commit-message.prefix` set match that package's scope (and `fix(<scope>)` vs `chore(<scope>)` chosen deliberate depending whether dependency bumps for that package should auto-release). Don't silently pick `fix` vs `chore` yourself — policy call (auto-publish dependency bumps vs. batch into hand-authored releases); ask.

Bumps only touch **transitive** deps (not present in any workspace `package.json` directly) don't have this problem — no package to release, generic `deps` scope harmless there.

## Core rule: one PR at time, full cycle, no batching

**Do not** fire `@dependabot rebase` (or merge) across multiple PRs at once then work thru results. In monorepo w/ single `package-lock.json`, merging one dependency bump changes lockfile, immediately flips **every other open Dependabot PR** clean → conflicting. Batch-rebasing just means re-requesting rebases again after each merge.

Correct loop, per PR:

1. Check `mergeStateStatus` / `mergeable` + CI checks.
2. If conflicting, comment `@dependabot rebase`, wait.
3. Once clean + green, verify commit triggers right release (see ⚠️ above).
4. Merge via Dependabot (see below).
5. **Only then** move to next PR.

```sh
gh pr list --repo <owner>/<repo> --state open --author "app/dependabot" \
  --json number,title,mergeable,mergeStateStatus
```

## Merge via Dependabot, not `gh pr merge`

Comment one of these instead of merge manual:

- `@dependabot merge` — merge once checks pass (uses repo's default merge method)
- `@dependabot squash and merge` — force squash
- `@dependabot rebase` — pull latest target branch into PR branch
- `@dependabot recreate` — close + reopen as **fresh** PR built from scratch against current main. Use instead of `rebase` when checks fail for reasons unrelated to bumped dependency — e.g. `npm ci` erroring `Missing: <unrelated-pkg>@<version> from lock file` on old branch predating later root `package.json` changes. Plain rebase only replays target-branch merge; won't regenerate lockfile drifted from unrelated changes. `recreate` regenerates whole lockfile against current main.
- `@dependabot close` — abandon (dependabot won't reopen later on own for that version)

Dependabot handles wait-for-checks + retry itself — no need poll + merge by hand.

### Watch for these Dependabot responses

- **`Superseded by #N`** — Dependabot closed PR you were tracking, opened new one (typically newer version became available, or `recreate`/`rebase` folded it together w/ another pending bump for same ecosystem). Switch to tracking `#N`; old PR dead, don't keep polling it.
- Dependabot may **combine** separate bumps into one PR on recreate (e.g. `vite` bump + `@react-router/dev` bump landing single PR) if became re-resolvable together. Expect PR counts/numbers shift across triage session — always re-list open PRs rather than assume original PR numbers still current.
- PR can be **auto-closed by Dependabot itself** w/ "Looks like these dependencies are updatable in another way, so this is no longer needed" — check for replacement PR before conclude dependency unhandled.

## Use worktree for local investigation

If need reproduce CI failure locally (e.g. confirm `npm ci` lockfile-drift error rather than trust log alone) — esp if another agent/session might already be using repo's primary working directory — do in separate git worktree, not main checkout:

```sh
git worktree add ../<repo>-worktrees/dependabot-triage -b chore/dependabot-triage origin/main
```