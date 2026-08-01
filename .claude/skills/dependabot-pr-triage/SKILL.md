---
name: dependabot-pr-triage
description: Triage open Dependabot PRs in GitHub repo — rebase/recreate stale, verify trigger right release under repo's commit-msg conventions, merge via Dependabot itself not manual. Trigger: asked clean up/triage/merge Dependabot PRs, or repo got pile open `dependabot/...` branches.
---

# Dependabot PR triage

Process for batch open Dependabot PRs. Repo w/ shared lockfile (npm/yarn/pnpm workspaces) + conventional-commit releases (semantic-release-style). From real triage, monorepo w/ per-package versioning.

## ⚠️ Before merging ANYTHING: verify commit triggers right release

Do first, before touch any PR — affects how merge whole batch.

Read release docs (usually `README.md`) + commitlint config (`commitlint.config.js` or similar) **before** trust merged Dependabot PR. Two silent failure modes (merge succeeds, no error):

1. **Wrong scope.** Dependabot built-in conventional-commit auto-detect (used when no `.github/dependabot.yml` commit-message config) infers style from last ~20 commits but always emits generic scope: `deps` prod, `deps-dev` dev. If release tooling walks commits **per package** matching scope to package/workspace name (e.g. `auth-provider-email`, `auth-adapter-react-router`), `deps` scope never attributed to package it actually changed — even tho really did bump that package's `package.json`.
2. **Wrong type.** Auto-detected type always `chore`. If version-bump rules treat `chore` as no-release (common — only `fix`/`feat` cut release), dependency bumps — incl future security fixes — merge but **never publish**.

Check if PR affected:

```sh
# Which workspace package.json files does this bump actually touch?
git show <merge-commit-sha> --stat | grep package.json

# Does the commit's scope match one of those package directory names,
# and is the commitlint scope-enum (if any) satisfied?
cat commitlint.config.js   # look for scope-enum
```

Bump touches real published workspace package but arrives `chore(deps): ...` / `chore(deps-dev): ...` → ships un-released. Don't auto-fix mid-triage — repo-level gap, flag to user: add `.github/dependabot.yml` w/ one `updates` entry per package `directory`, each w/ `commit-message.prefix` matching package scope (`fix(<scope>)` vs `chore(<scope>)` deliberate — auto-release bumps or not). Don't pick `fix` vs `chore` yourself — policy call; ask.

Bumps touching only **transitive** deps (not in any workspace `package.json` directly) safe — no package to release, generic `deps` scope harmless.

## ⚠️ Check for sibling packages that must move together

Some ecosystems ship package families needing matched versions — framework core + dev/build/server companions, client + codegen/CLI. Dependabot bumps one dep at a time; no "these N move together" notion. Merging one bump leaves mixed-version combo that builds, typechecks, passes tests — CI never exercises mismatch — quietly unsupported.

Example (react-router, generalizes to any lockstep family): bumped `react-router` 7.15.0 → 8.3.0, left siblings `@react-router/dev`, `@react-router/serve`, `@react-router/node` on 7.15.0. CI fully green — build, typecheck, full e2e passed. Caught only by later manual audit.

After merge, check for known siblings in same `package.json`, confirm moved too:

```sh
# list other deps from the same publisher/scope as the one just bumped
grep -E '"@<scope>/' package.json
```

**Green CI not proof combo safe** — only means existing tests pass against whatever versions in tree. Skim ecosystem release notes for "upgrade together" / peer-version language before merging package known to have siblings.

## Core rule: one PR at time, full cycle, no batching

**No** `@dependabot rebase` (or merge) across many PRs then work thru results. Monorepo w/ single `package-lock.json`: one merge changes lockfile, flips **every other open Dependabot PR** clean → conflicting. Batch-rebase = re-request rebases after every merge.

Loop, per PR:

1. Check `mergeStateStatus` / `mergeable` + CI checks.
2. Conflicting → comment `@dependabot rebase`, wait.
3. Clean + green → verify commit triggers right release (⚠️ above).
4. Merge via Dependabot (below).
5. **Only then** next PR.

```sh
gh pr list --repo <owner>/<repo> --state open --author "app/dependabot" \
  --json number,title,mergeable,mergeStateStatus
```

## Merge via Dependabot, not `gh pr merge`

Comment one of these, not manual merge:

- `@dependabot merge` — merge once checks pass (repo default merge method)
- `@dependabot squash and merge` — force squash
- `@dependabot rebase` — pull latest target branch into PR branch
- `@dependabot recreate` — close + reopen as **fresh** PR from scratch against current main. Use over `rebase` when checks fail for reasons unrelated to bumped dep — e.g. `npm ci` error `Missing: <unrelated-pkg>@<version> from lock file` on old branch predating later root `package.json` changes. Plain rebase only replays target-branch merge; won't regenerate drifted lockfile. `recreate` regenerates whole lockfile.
- `@dependabot close` — abandon (won't reopen for that version)

Dependabot handles wait-for-checks + retry — no manual polling.

### Watch for these Dependabot responses

- **`Superseded by #N`** — tracked PR closed, new one opened (newer version, or `recreate`/`rebase` folded bumps together). Track `#N`; old PR dead.
- Dependabot may **combine** bumps into one PR on recreate (e.g. `vite` + `@react-router/dev` land together) if re-resolvable together. PR counts/numbers shift across session — always re-list, don't assume old numbers current.
- PR can **auto-close** w/ "Looks like these dependencies are updatable in another way, so this is no longer needed" — check for replacement PR before concluding dep unhandled.

## ⚠️ Dependabot's own lockfile regen can be broken — `recreate` doesn't always fix it

Seen: `npm ci` fails CI w/ `EUSAGE` / `Missing: <pkg>@<version> from lock file`, looks like ordinary drift (see `recreate` above) — but after `@dependabot recreate`, **same error** on fresh PR against current main. Root cause not stale branch — Dependabot lockfile generator produced bad lockfile (seen dropping `"dev": true` flags + omitting top-level entries for transitive deps like `conventional-commits-parser`/`meow` from semantic-release tooling, nested copies present at diff version).

Confirm before assuming:

```sh
# reproduce in isolated worktree, don't touch primary checkout
git worktree add /tmp/<repo>-lockcheck origin/<dependabot-branch> -q
cd /tmp/<repo>-lockcheck && npm ci   # reproduces EUSAGE error locally
```

Fix — regenerate lockfile w/ plain `npm install`, verify, commit, push to dependabot PR branch (normal git, nothing special):

```sh
npm install --package-lock-only --ignore-scripts   # --ignore-scripts: node_modules not installed yet, prepare/husky script would fail
git diff --stat package-lock.json                  # sanity check: only lockfile entries, no unrelated pkg version bumps
rm -rf node_modules && npm ci --ignore-scripts      # verify ci now clean
git add package-lock.json && git commit -S -m "fix: repair lockfile drift left by dependabot lockfile regen"
git push origin HEAD:<dependabot-branch-name>
```

Pushing to Dependabot PR branch is real push to shared/visible branch — confirm with user first (per general push-confirmation rule); do not treat a timeout as tacit yes.

Multiple PRs same symptom same session → likely same repo-level lockfile inconsistency (not per-PR) — same fix each, still one-PR-at-a-time per core rule.

## Use worktree for local investigation

Need reproduce CI failure locally (e.g. confirm `npm ci` lockfile-drift error, not trust log alone) — esp if another agent/session may use primary working dir — separate git worktree, not main checkout:

```sh
git worktree add ../<repo>-worktrees/dependabot-triage -b chore/dependabot-triage origin/main
```