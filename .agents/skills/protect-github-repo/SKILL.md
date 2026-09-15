---
name: protect-github-repo
description: Protect a GitHub repo's default branch and ownership — add a CODEOWNERS file naming the owner as owner of everything, a ruleset requiring PR + code-owner review, squash-only merges, no deletion/force-push, with only the owner able to bypass, and enable repo-level auto-merge so PR authors can turn on "Auto-merge". Optionally requires selected status checks to pass. Runs a deterministic .mts script (via gh CLI) that inspects current state, backs up anything it would overwrite, and never overwrites without confirmation. Trigger: asked to protect/lock down a repo, set up branch protection, add CODEOWNERS, enable auto-merge, or apply "the usual" repo protection to a new or existing repo.
---

# Protect a GitHub repo

Standard repo-protection setup: a CODEOWNERS file naming one person as owner of everything, and
a ruleset that requires a pull request with that owner's approval before merging to the default
branch, blocks deletion and force-push, restricts merges to squash-only, and lets only the named
owner bypass. Optionally requires selected CI status checks to pass and the branch to be up to
date before merge.

The actual GitHub writes are done by a deterministic script (`scripts/protect-repo.mts`), not by
hand-rolled `gh api` calls in this document — see [Run the script](#run-the-script). It's
executable directly (`./protect-repo.mts ...`) via a `#!/usr/bin/env -S node
--experimental-strip-types` shebang, so there's no separate build step. The script itself uses
the `gh` CLI for every API call, so it inherits whatever account is currently `gh auth`'d — it
never touches a token directly.

## Prerequisites

Run `npm install` once in `scripts/` before first use — it installs the `prompts` runtime
dependency (interactive fallback for `apply`; see [Run the script](#run-the-script)). Needs
Node ≥22.6 for `--experimental-strip-types` (see [Gotchas](#gotchas)).

## ⚠️ Confirm the target before running anything

This skill changes who can write to a repository. Do not infer the target from the current
working directory, the git remote, a recently discussed repo, or a similar-sounding name.

**Ask the user, and wait for an answer, unless they named it explicitly in the request:**

1. **Which repository or repositories?** Full `owner/repo`. If they gave a bare name, confirm
   the owner rather than assuming.
2. **Who is the code owner?** Defaults to `activescott` (the script's default). Confirm if the
   request implies someone else, or an org repo with a different intended owner.
3. **Add a collaborator, and who?** Separate decision from the protection setup itself — see
   [Add a collaborator](#add-a-collaborator-optional).

If several repos were named, list them back and confirm the set before the first write. Applying
this to the wrong repo can block the owner from merging, and there is no single-command undo —
that's what the backups in [Run the script](#run-the-script) are for.

## What "protected" means here

On the default branch, via a ruleset named `protect-default-branch`:

- `pull_request` — 1 approving review required, **and** review from a code owner required
  (`require_code_owner_review: true`)
- `allowed_merge_methods: ["squash"]` — squash is the only merge method the merge button offers
- `deletion` — branch cannot be deleted
- `non_fast_forward` — no force-push
- bypass: only the named owner (a `User` bypass actor, not the `Repository admin` role — see
  [Gotchas](#gotchas))
- if the user opted into status checks: `required_status_checks` with
  `strict_required_status_checks_policy: true` (this is the "branch must be up to date before
  merging" behavior — it only has meaning when there's at least one required check)

And in the repo, a `CODEOWNERS` file (created at `.github/CODEOWNERS` if none exists yet, or
updated in place wherever GitHub already finds one):

```
# Managed by the protect-github-repo skill.
* @<owner>
```

And on the repo itself, `allow_auto_merge: true` — this enables the "Auto-merge" button GitHub
shows on a PR; it does not merge anything by itself. A PR still needs its required review(s) and
status checks (if any) to pass before GitHub actually merges it. Skip with `--skip-auto-merge` if
you don't want this.

## Run the script

```bash
cd .agents/skills/protect-github-repo/scripts
./protect-repo.mts inspect <owner>/<repo> --json
```

This is read-only. **Always pass `--json` when you (the agent) are the one reading the output** —
it's the structured form the rest of this workflow parses. Without `--json`, `inspect` prints a
human-readable status report instead (checkmarks/warnings, a real field-level diff for anything
that doesn't match, one line per available status check) — offer that form to the user if they
want to eyeball a repo's state themselves; don't parse it.

Either form reports:

- whether a `protect-default-branch` ruleset already exists, and if so whether its core rules
  (everything except required status checks) already match canonical, plus what status checks it
  currently requires (if any)
- any *other* branch rulesets present (the script never touches these — just warns)
- whether CODEOWNERS already exists, where, and whether its content matches canonical
- the repo's available status-check contexts — real check-run names actually seen on the default
  branch's tip commit, each flagged as already-required or addable

**Read the result before doing anything else.** Specifically:

1. **If a `protect-default-branch` ruleset or CODEOWNERS already exists and differs from canonical** —
   STOP. Show the user the diff (the JSON form's `rulesets[].diff` / `codeowners.content` fields,
   or just run the non-`--json` form for a human-readable version of the same thing) and ask:
   overwrite, or leave it alone? Do not assume; a differing existing setup may be intentional.
   This is true even if it *looks* similar (e.g. the reference ruleset at
   `activescott/home-infra-k8s-flux` predates this skill and does not match — it bypasses via the
   `Repository admin` role and allows all three merge methods).
2. **If `availableStatusChecks` is non-empty**, ask the user (multi-select, zero is a valid
   answer) which of the listed contexts, if any, should be required to pass. Do not guess or
   default to "all of them."
3. **If `availableStatusChecks` is empty**, don't ask — there's nothing to require yet, and
   `strict_required_status_checks_policy` (branch-up-to-date) has no effect without at least one
   required check.

Then apply:

```bash
./protect-repo.mts apply <owner>/<repo> [--status-checks <ctx1,ctx2 | none>] \
  [--overwrite-ruleset] [--overwrite-codeowners] [--skip-ruleset] [--skip-codeowners] \
  [--skip-auto-merge] [--bypass-user <login>]
```

- **As the agent, always pass every flag explicitly** — `--status-checks`, and
  `--overwrite-ruleset`/`--skip-ruleset` and `--overwrite-codeowners`/`--skip-codeowners`
  whenever `inspect` showed an existing, differing mechanism. Pass the exact contexts the user
  picked in step 2, comma-separated, or the literal string `none`.
- Auto-merge has no overwrite decision — it's a single boolean, and enabling it doesn't merge
  anything or change existing PRs. `apply` turns it on unless `inspect` already showed it enabled,
  or you pass `--skip-auto-merge`.
- If a flag needed for a decision is left out, `apply` falls back to an interactive terminal
  prompt (via the `prompts` npm package) — a convenience for a human running this directly in
  their own terminal, **not for you**. Run from the agent's non-interactive shell, a prompt has
  no TTY to read from and `apply` fails fast with `refusing to prompt (...) on non-interactive
  stdin` rather than hanging. That failure is expected in that case — it means a flag you should
  have supplied was missing, not a bug in the script.
- When a mechanism already matches canonical, or doesn't exist yet, `apply` never prompts for
  it — there's nothing to decide. Only a mismatch triggers the overwrite decision.
- Before any overwrite, the script writes the current ruleset JSON / CODEOWNERS content to
  `scripts/.protect-github-repo-backups/<owner>-<repo>/<timestamp>/` (anchored to the script's
  own directory, not wherever you ran it from) and prints the path. Tell the user where the
  backup landed.
- `--bypass-user` overrides the default `activescott` owner login.
- **No rollback across the two writes.** `apply` updates the ruleset and CODEOWNERS as two
  separate steps. If the first succeeds and the second fails (e.g. a transient `gh api` error),
  the repo is left with one updated and one not — re-run `apply` to finish the other; the backup
  from the completed step is already on disk if you need to compare or revert it.

Re-run `inspect --json` afterward and confirm the report now shows `coreMatchesCanonical: true`,
`codeowners.matchesCanonical: true`, and `autoMerge.enabled: true` (plus the status checks the
user chose), and report that back to the user along with the backup path(s) if anything was
overwritten.

## Add a collaborator (optional)

Separate decision from the protection setup — a repo can get one without the other.

```bash
gh api -X PUT repos/<owner>/<repo>/collaborators/<user> -f permission=push \
  --jq '{invitee: .invitee.login, permissions: .permissions}'
```

`push` is "write." On personal repos this is the only write level available — it does **not**
prevent merging on its own; the ruleset is what requires a PR and a review. Collaborator
permission and the ruleset are not substitutes for each other; a repo with one and not the other
is misconfigured.

**The invitee must accept.** The owner cannot accept on their behalf. Until accepted, their
permission reads `none` and everything they attempt fails to authenticate, which looks like a
broken token rather than a pending invite. Always tell the user an invite is waiting.

## Gotchas

- **Needs Node ≥22.6** for `--experimental-strip-types` (unflagged by default starting in Node
  23.6+, but the flag works fine on 22.x too — verified against 22.23.2). Its one runtime
  dependency is `prompts` (interactive fallback for `apply`) — run `npm install` in `scripts/`
  once before first use. `typescript`/`@types/node`/`@types/prompts` are devDependencies for
  editor type-checking only (`npx tsc --noEmit -p tsconfig.json`).
- **Bypass is a `User`, not the `Repository admin` role, and that's deliberate.** Any repo
  admin-of-the-role (e.g. a promoted collaborator) would also bypass under `RepositoryRole`. This
  skill locks bypass to the one named person instead. It's a different choice than some
  pre-existing repos may use — don't treat those as the template to match.
- **Status-check contexts are per-job check-run names, not the workflow's own name.** A workflow
  declared `name: validate` with a job `kustomize-build` registers as the check-run
  `"kustomize-build"` — never `"validate"`. `inspect`'s `availableStatusChecks` is sourced only
  from real check-runs on the default branch's tip commit for exactly this reason: the Actions
  workflows list (`repos/{owner}/{repo}/actions/workflows`) returns workflow names, which can
  never satisfy a required status check — offering one as a candidate would let someone require a
  check that never passes, permanently blocking merges. One consequence: if the repo has never
  run a check against that exact commit (e.g. checks only fire on `pull_request`, not `push` to
  the default branch), `availableStatusChecks` can come back empty even though workflows exist —
  mention this to the user rather than falling back to the workflow name.
- **Private repos need a paid plan.** Rulesets enforce on public repos on any plan, but on
  private repos only with Pro, Team, or Enterprise. On a Free account a ruleset on a private repo
  will not be enforced — check the plan before promising protection.
- **`require_code_owner_review` needs a matching CODEOWNERS to have any effect** — that's why
  this skill always pairs the ruleset with the CODEOWNERS file rather than doing either alone.
- Repeat `inspect`/`apply` for every repo the user wants protected; there's no bulk mode built in
  on purpose — the confirm-before-overwrite step needs a human per repo.

## Reference: canonical ruleset payload

Built by `scripts/lib/ruleset.mts::buildCanonicalRuleset` — shown here for readability, not to be
hand-copied (the script is the source of truth):

```json
{
  "name": "protect-default-branch",
  "target": "branch",
  "enforcement": "active",
  "bypass_actors": [
    { "actor_id": "<owner's numeric user id, resolved at runtime>", "actor_type": "User", "bypass_mode": "always" }
  ],
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 1,
        "dismiss_stale_reviews_on_push": false,
        "required_reviewers": [],
        "require_code_owner_review": true,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false,
        "require_extra_approval_for_unattributed_changes": true,
        "allowed_merge_methods": ["squash"]
      }
    },
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "required_status_checks",
      "parameters": {
        "required_status_checks": [{ "context": "<only if the user opted in>" }],
        "strict_required_status_checks_policy": true
      }
    }
  ]
}
```

`~DEFAULT_BRANCH` is a GitHub-provided alias, so the ruleset follows a renamed default branch
instead of pointing at a branch that no longer exists. The `required_status_checks` rule is
omitted entirely when the user chose zero checks.
