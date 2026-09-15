---
name: add-github-collaborator
description: Add a GitHub user as a repo collaborator with write ("push") access — never admin — so they can merge their own pull requests once branch protection checks pass. Only proceeds if the repo already has the owner listed in CODEOWNERS and an active branch protection rule (ruleset or classic) on the default branch requiring code-owner review; otherwise refuses, since without that a collaborator with write access could merge unreviewed changes. Runs a deterministic .mts script (via gh CLI) that checks both preconditions before sending the invite. Trigger: asked to add a collaborator, invite someone to a repo, or give someone merge access.
---

# Add a GitHub repo collaborator

Adds a user as a repo collaborator with `push` (write) permission — enough to merge a pull
request once it's approved and checks pass, never admin. Refuses to run unless the repo already
has real protection in place: a CODEOWNERS entry for the owner, and an active branch protection
rule on the default branch requiring a code-owner review. Without both, a `push`-level
collaborator could merge their own unreviewed PR — the [protect-github-repo](../protect-github-repo/SKILL.md)
skill is what sets that up.

The actual checks and the GitHub write are done by `scripts/add-collaborator.mts`, not by
hand-rolled `gh api` calls in this document. It imports `gh.mts`, `codeowners.mts`, and
`color.mts` from the `protect-github-repo` skill's `scripts/lib/` — both skills must stay
side by side in `.agents/skills/`. Like that skill's script, it uses the `gh` CLI for every API
call, so it inherits whatever account is currently `gh auth`'d.

## Prerequisites

Run `npm install` once in `scripts/` before first use (only devDependencies — `@types/node` /
`typescript` for editor type-checking; the script itself has no runtime dependencies). Needs
Node ≥22.6 for `--experimental-strip-types`.

## ⚠️ Confirm before running anything

This grants write access to a repository. Do not infer the repo or the collaborator's username
from context — **ask the user, and wait for an answer, unless both were named explicitly:**

1. **Which repository?** Full `owner/repo`.
2. **Which GitHub username** should be added as a collaborator?
3. **Who is the code owner** the preconditions should check for? Defaults to `activescott` —
   confirm if this repo's owner is someone else.

## Run the script

```bash
cd .agents/skills/add-github-collaborator/scripts
./add-collaborator.mts <owner>/<repo> <github-username> [--codeowner <login>] [--check-only]
```

- `--codeowner <login>` — who must be named in CODEOWNERS and required as a reviewer. Defaults
  to `activescott`.
- `--check-only` — run both preconditions and report the result, without sending the invite.
  Use this first if you want to show the user the preflight result before committing to the
  write.

The script always prints the preflight result before doing anything else:

1. **CODEOWNERS check** — does an existing CODEOWNERS file (checked at the same three locations
   GitHub itself reads: `CODEOWNERS`, `.github/CODEOWNERS`, `docs/CODEOWNERS`) name `@<codeowner>`
   on some pattern line?
2. **Branch protection check** — does the default branch have an active rule requiring a
   code-owner review before merge? Checks both mechanisms: a ruleset (any name, not just
   `protect-default-branch`) with an active `pull_request` rule where
   `require_code_owner_review: true`, applied to the default branch and not excluded from it; or
   classic branch protection with `required_pull_request_reviews.require_code_owner_reviews: true`.

**If either check fails, the script exits non-zero and never calls the collaborators endpoint.**
Report the failure to the user and point them at the `protect-github-repo` skill rather than
trying to work around it — e.g. do not fall back to a lower permission or a different API call to
get the invite to go through anyway.

If both checks pass and `--check-only` wasn't given, it sends the invite:

```bash
gh api -X PUT repos/<owner>/<repo>/collaborators/<user> -f permission=push
```

- `push` is hardcoded — this script does not accept a `--permission` flag. If a request implies
  admin or maintainer access, that's a different, more consequential ask; don't repurpose this
  script for it.
- **The invitee must accept.** The owner cannot accept on their behalf. Until accepted, their
  permission reads `none` and everything they attempt fails to authenticate, which looks like a
  broken token rather than a pending invite. Tell the user an invite is waiting, and share the
  `html_url` the script prints.
- If the user already has repo access, GitHub updates their permission in place instead of
  issuing a new invite (a 204 with no body) — the script reports this distinctly from a fresh
  invite.
- Needs admin on the target repo; the script checks this itself and fails fast with a clear
  message if the current `gh auth` doesn't have it.

## Gotchas

- **This does not replace branch protection — it depends on it already being correct.** A repo
  where CODEOWNERS or the ruleset only *looks* right (e.g. CODEOWNERS exists but doesn't name the
  expected owner, or a ruleset exists but isn't `enforcement: active`, or applies to a different
  branch) fails the preflight and that's correct behavior, not a bug to work around.
- **Ruleset applicability is checked narrowly**: `conditions.ref_name.include` must contain
  `~DEFAULT_BRANCH` or `refs/heads/<default_branch>` literally, and that same value must not
  also appear in `exclude`. A ruleset that protects the default branch through a different
  pattern (e.g. a glob) won't be recognized — this mirrors what `protect-repo.mts` itself writes,
  so a repo set up via that skill always passes.
- **`push` permission alone doesn't force review** — it's the branch protection rule that blocks
  merging until a code owner approves. That's the whole reason this script's preconditions exist:
  granting `push` on an unprotected repo would let the new collaborator merge anything,
  immediately.
