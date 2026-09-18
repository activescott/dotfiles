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

Optionally, a `DeployKey` bypass actor — lets any deploy key with write access on the repo push
straight to the default branch, bypassing the PR requirement. This is for automation (e.g. a
release job) that needs to push without going through a PR; it is off by default and never added
implicitly — see [Deploy-key bypass (optional)](#deploy-key-bypass-optional).

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
  [--skip-auto-merge] [--bypass-user <login>] \
  [(--deploy-key <public-key-value> | --deploy-key-file <path>) [--deploy-key-title <title>] | --skip-deploy-key] \
  [--deploy-key-private-key-file <path> [--deploy-key-secret-name <name>] | --skip-deploy-key-secret]
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

## Deploy-key bypass (optional)

For automation that needs to push straight to the default branch (e.g. a release job that bumps a
version and pushes the commit itself, rather than opening a PR): add its SSH public key to the
repo as a deploy key with write access, and let it bypass the ruleset. This is a separate,
opt-in decision from the rest of `apply` — it's never added implicitly, and it's additive (running
`apply` again without it never removes an existing deploy-key bypass).

```bash
./protect-repo.mts apply <owner>/<repo> --deploy-key "ssh-ed25519 AAAA... comment" \
  [--deploy-key-title <title>] --status-checks <...> ...
# or, from a file:
./protect-repo.mts apply <owner>/<repo> --deploy-key-file <path-to-public-key> \
  [--deploy-key-title <title>] --status-checks <...> ...
```

- `--deploy-key` — the **public** key value itself (e.g. pasted from a password manager — it's
  not secret, so this is fine on the command line or at the interactive prompt). `--deploy-key-file`
  — same thing, but read from a file instead. Pass exactly one. Either way, the script adds it to
  the repo via `POST /repos/{owner}/{repo}/keys` with `read_only: false` — **skipped if that exact
  key material is already registered on the repo with write access** (compared by algorithm +
  base64 body, ignoring the trailing comment, via `findDeployKeyByMaterial`) — then, if the
  ruleset doesn't already have one, appends a `DeployKey` bypass actor
  (`{ actor_id: null, actor_type: "DeployKey", bypass_mode: "always" }`) to it. It never touches a
  private key; only the public half is ever read.
- `--deploy-key-title` — defaults to the pasted key's trailing comment (e.g. `release@fernfiles`),
  or the file's basename with any `.pub` suffix stripped when using `--deploy-key-file`.
- `--skip-deploy-key` — explicitly skip; no prompt.
- **Omitting all three, as the agent, means "leave it alone"** — unlike every other `apply`
  decision, an omitted deploy-key flag on non-interactive stdin does not fail fast. It's opt-in
  and rare enough that a human running this directly instead gets a confirm prompt followed by a
  single free-text prompt that accepts **either the pasted public key or a path to a file
  containing it** (detected by whether it starts with a known key-type prefix like `ssh-ed25519`),
  matching the `prompts`-based fallback used elsewhere in this script — but a non-interactive
  `apply` call that doesn't mention it just skips it; there is nothing to decide by default.
- **Requires the ruleset itself** (bypass actors live on it) — combining `--deploy-key`/
  `--deploy-key-file` with `--skip-ruleset` is an error.
- A deploy key already on the repo as **read-only** cannot be reused for this — GitHub's bypass
  applies to any deploy key with write access, so a read-only match makes `apply` fail rather than
  silently do nothing; remove it or use a different key.
- `inspect` reports current state under "Deploy-key bypass": whether the ruleset already has a
  `DeployKey` bypass actor, and which of the repo's deploy keys (if any) currently have write
  access.

### Storing the matching private key as a secret

A deploy key's public half alone doesn't help a GitHub Actions workflow authenticate as it — the
workflow needs the **private** key, e.g. passed as `ssh-key:` to `actions/checkout` so a release
job's push can use the bypass actor above (see `tinkerbell`'s `ci.yaml` `release` job for the
pattern). Dependabot can use the same key (e.g. for a private git dependency) via its own,
separate secret store — repo Actions secrets and Dependabot secrets are not the same list, so the
key has to be uploaded to both explicitly.

```bash
./protect-repo.mts apply <owner>/<repo> --deploy-key-private-key-file <path-to-private-key> \
  [--deploy-key-secret-name <name>] --status-checks <...> ...
```

- `--deploy-key-private-key-file` — path to the **private** key file only. There is no flag that
  takes the value directly — a private key must never appear as a CLI argument, since that's
  visible in `ps`/argv and gets written to shell history regardless of masking. The script wires
  the file straight to `gh secret set`'s stdin (an open file descriptor, not a JS string), so the
  key's bytes pass through `gh`'s own client-side encryption without this script or its caller
  ever holding or printing the plaintext.
- `--deploy-key-secret-name` — defaults to `RELEASE_DEPLOY_KEY`.
- Sets the same value as both an Actions secret and a Dependabot secret (`gh secret set --app
  actions` / `--app dependabot`), always both — never one without the other.
- `--skip-deploy-key-secret` — explicitly skip; no prompt.
- **Omitting both, as the agent, means "leave it alone"** — same non-interactive-stdin shape as
  the deploy key itself: no prompt, no error. A human running this directly gets a confirm prompt,
  a secret-name prompt (defaulting to `RELEASE_DEPLOY_KEY`), then a choice: paste the key value
  directly, or point at a file. A pasted value goes through `pastedSecretPrompt` — echo fully
  suppressed (nothing appears on screen, like a `sudo` password prompt), multi-line safe (see
  [Gotchas](#gotchas) for why a naive masked prompt isn't) — so a key that only ever lives in a
  password manager never has to touch disk.
  - The flag form (`--deploy-key-private-key-file`) is still file-only — a CLI argument is
    visible in `ps`/argv and lands in shell history regardless of masking, so there's no flag
    equivalent for a literal value.
- Independent of the deploy-key-bypass flags above — it doesn't require a new deploy key to be
  added this run (the key may already be registered from a previous `apply`), and it doesn't
  require the ruleset.
- `inspect` reports existing secret **names only** (never values) under "Secrets", for both
  Actions and Dependabot, so you can tell whether `RELEASE_DEPLOY_KEY` (or whatever name was
  chosen) is already set without ever fetching its value — GitHub's API doesn't expose secret
  values anyway.

## Gotchas

- **Pasting the private key uses a custom reader (`pastedSecretPrompt`), not the `prompts`
  package.** SSH private keys are multi-line PEM text, and the `prompts` npm package (used for
  every other interactive fallback in this script) is line-based: its text/password prompts treat
  the first newline in your input as Enter, submitting right after the key's first line —
  everything after that spills onto the terminal raw, past the library's control, unmasked
  (masking doesn't help; a `password`-style `prompts` field has the exact same bug). Instead,
  `pastedSecretPrompt` reads directly via Node's core `readline`, whose `'line'` event correctly
  fires once per embedded newline in a pasted chunk without dropping any, with echo fully
  suppressed via `readline`'s undocumented `_writeToOutput` hook (declared via a `declare module
  "node:readline"` augmentation in `lib/prompt.mts`, not an `any`/`as` cast — a long-standing,
  dependency-free technique for hiding input with core `readline`). It stops automatically at the
  key's own `-----END ... PRIVATE KEY-----` trailer line, or on Ctrl+D.

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
  from real check-runs — never from the Actions workflows list
  (`repos/{owner}/{repo}/actions/workflows`), which returns workflow names, not check-run names,
  and offering one as a candidate would let someone require a check that never passes, permanently
  blocking merges.
  It reads check-runs from two places: the default branch's tip commit, and a recent pull
  request's head commit. Both matter, because each source misses a different kind of check.
  Push-triggered checks (most CI) show up on the tip commit but not necessarily on a PR — those
  get filtered out unless their workflow's `on:` includes `pull_request`/`pull_request_target`,
  since requiring one that can't run on a PR would permanently block every merge.
  `pull_request`-only checks (e.g. a PR-title linter) are the opposite: entirely valid to require,
  but they never run on a push to the default branch, so they'd never show up from the tip-commit
  source alone no matter how long you wait — the PR-head source is what surfaces those. If the
  repo has no commit history and no PRs yet, `availableStatusChecks` can still come back empty —
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
omitted entirely when the user chose zero checks. Likewise, `bypass_actors` gets a second entry —
`{ "actor_id": null, "actor_type": "DeployKey", "bypass_mode": "always" }` — only when the user
opted into [deploy-key bypass](#deploy-key-bypass-optional); omitted here as it's off by default.
