---
name: forgejo-cli
description: Use the forgejo-cli (`fj`) for PR, issue, release, and Actions workflows in Codeberg or any Forgejo-hosted repo — the analog of `gh` on GitHub. Trigger when the working repo's remote is on codeberg.org or another Forgejo host, or when the user mentions Codeberg / Forgejo / `fj`.
---

# forgejo-cli (`fj`) quick reference

Use this when you would otherwise reach for `gh` but the repo is hosted on Codeberg or another Forgejo instance. `gh` does **not** work against Forgejo — its API is GitHub-only.

## Detect the host

Run this before assuming `gh` works:

```sh
git remote -v | grep -E 'codeberg\.org|forgejo' && echo "use fj" || echo "use gh (or check the host)"
```

If the remote URL is `codeberg.org` or a known self-hosted Forgejo, use `fj`. If it's `github.com`, use `gh`. For anything else, ask.

## Install if missing

```sh
# macOS
brew install forgejo-cli

# Debian / Ubuntu
sudo apt install forgejo-cli
```

Upstream: https://codeberg.org/forgejo-contrib/forgejo-cli

First-time auth: `fj auth login` (Codeberg's host is `codeberg.org`, the default). For self-hosted Forgejo pass `-H <host>` to any command, or `fj auth login` against that host once.

## `gh` → `fj` cheatsheet

The commands below are ordered by how often the corresponding `gh` command shows up in this user's history — top entries first.

| Task                      | `gh` (GitHub)                        | `fj` (Forgejo)                                                             |
| ------------------------- | ------------------------------------ | -------------------------------------------------------------------------- |
| View a PR                 | `gh pr view <id>`                    | `fj pr view <id>` (defaults to body)                                       |
| List recent CI runs       | `gh run list`                        | `fj actions tasks`                                                         |
| View a CI run             | `gh run view <id>`                   | (no CLI; `fj pr status <id>` for the PR's checks, else open in browser)    |
| PR check status           | `gh pr checks <id>`                  | `fj pr status <id>` (parser-buggy when no checks — see Gotchas)            |
| Wait for checks           | `gh run watch <id>`                  | `fj pr status <id> --wait` (same caveat)                                   |
| List/search PRs           | `gh pr list`                         | `fj pr search [query] [-s open\|closed\|all]`                              |
| Merge a PR                | `gh pr merge <id>`                   | `fj pr merge <id> [-M squash\|merge\|rebase] [-d]`                         |
| View PR diff              | `gh pr diff <id>`                    | `fj pr view <id> diff` (add `-p` for patch)                                |
| Create a PR               | `gh pr create`                       | `fj pr create [title] --base <b> --head <h> [--body \| --body-file \| -A]` |
| Comment on PR             | `gh pr comment <id> -b "…"`          | `fj pr comment <id> "…"`                                                   |
| Checkout PR locally       | `gh pr checkout <id>`                | `fj pr checkout <id>`                                                      |
| Edit PR title/body/labels | `gh pr edit <id> …`                  | `fj pr edit <id> title\|body\|labels …`                                    |
| Close PR (no merge)       | `gh pr close <id>`                   | `fj pr close <id>`                                                         |
| View PR comments          | `gh pr view <id> --comments`         | `fj pr view <id> comments`                                                 |
| View PR files             | `gh pr view <id> --json files …`     | `fj pr view <id> files`                                                    |
| View PR commits           | (n/a directly)                       | `fj pr view <id> commits [-o]`                                             |
| View an issue             | `gh issue view <id>`                 | `fj issue view <id>`                                                       |
| List/search issues        | `gh issue list`                      | `fj issue search [query] [-s open\|closed\|all] [-l label]`                |
| Create an issue           | `gh issue create`                    | `fj issue create [title] [--body \| --body-file \| --template <name>]`     |
| Comment on issue          | `gh issue comment <id> -b "…"`       | `fj issue comment <id> "…"`                                                |
| Close issue               | `gh issue close <id>`                | `fj issue close <id> [-w "closing comment"]`                               |
| Edit issue                | `gh issue edit <id> …`               | `fj issue edit <id> title\|body\|labels …`                                 |
| Assign issue/PR           | `gh issue edit <id> --add-assignee`  | `fj issue assign <id> <user>…` / `fj pr assign <id> <user>…`               |
| Releases                  | `gh release create/list/view/delete` | `fj release create/list/view/delete`                                       |
| Dispatch workflow         | `gh workflow run <name>`             | `fj actions dispatch <name> <ref> [-I key=val]`                            |
| Open in browser           | `gh pr view -w`                      | `fj pr browse <id>` (also `fj issue browse`, `fj repo browse`)             |
| Repo fork / clone / view  | `gh repo fork/clone/view`            | `fj repo fork/clone/view`                                                  |

### No direct `fj` equivalent

- **`gh api`** — there is no generic `fj api` passthrough. For raw Forgejo API calls, use `curl` with a token from `~/.config/forgejo-cli/`, or pick the closest `fj` subcommand.
- **`gh run view <id> --log`** — Forgejo Actions logs aren't exposed via `fj`. Use the web UI (`fj repo browse` then navigate, or open the run URL directly).
- **`gh issue develop`** — no equivalent; create the branch yourself.

## Flags worth remembering

Flag **position** is fiddly in `fj` — most flags only work in one specific spot, and clap's error message ("unexpected argument") doesn't hint at the right one. Match the slot exactly:

- `-R, --remote <name>` — pick which **local git remote** to operate on (default: origin). Lives on the **subcommand group** (e.g. `fj pr -R upstream view 2 body`), NOT on `fj` itself and NOT on the action subcommand. Use in repos with multiple remotes — typically `origin` (your fork) vs. `upstream` (the project).
- `-r, --repo <owner/name>` — operate on a repo by name without needing a local remote. Lives on the **action subcommand**, and only some actions accept it (e.g. `fj pr search -r owner/repo`, `fj issue search -r owner/repo`). For actions that don't, use `-R <remote>` against a configured local remote instead.
- `-H, --host <host>` — target a non-Codeberg Forgejo instance. **Top-level** on `fj`, before the subcommand: `fj -H code.example.com pr view 5`.
- `--style minimal` — plain output for piping. `fj` already detects non-TTY but this forces it.

## Known gotchas

- **`fj pr search <query>` searches title/body, not the branch name.** Searching for a branch like `fix/foo` returns 0 results even when a PR for that branch exists. To find a PR by branch, list all open PRs (`fj pr search -s open`) and eyeball it, or just open the branch in the web UI.
- **`fj pr search` is scoped to one repo at a time.** With both `origin` (your fork) and `upstream` (the project), the default search hits `origin` and shows nothing. Pass `-R upstream` (group-level) or `-r owner/repo` (action-level) to target the project.
- **`fj pr status <id>` can panic with `unknown variant \`\``** when the PR has no CI runs or an empty status string (`Error: the response from forgejo was not properly structured ... unknown variant \`\`, expected one of \`pending\`, \`success\`, \`error\`, \`failure\`, \`warning\``). Workaround: use `fj pr view <id>` for state, and `fj pr browse <id>` for checks in the web UI.

## Common workflows

**Open PR, check status, merge** (most-frequent flow):

```sh
fj pr view 42                    # body
fj pr view 42 diff               # diff
fj pr status 42 --wait           # block until checks finish
fj pr merge 42 -M squash -d      # squash + delete branch
```

**Triage an issue**:

```sh
fj issue search --state open -l bug
fj issue view 17
fj issue comment 17 "repro on main, looking now"
fj issue close 17 -w "fixed in #42"
```

**Create a PR from the current branch** (autofill title/body from commits):

```sh
fj pr create -A --base main
```

**List recent Actions runs**:

```sh
fj actions tasks            # page 1, 20 per page
fj actions tasks -p 2
```

## When to pick which CLI

A repo can have remotes pointing to **both** GitHub and a Forgejo host (e.g. a mirror), or have separate `origin` (your fork) and `upstream` (the project) remotes on the same Forgejo host. Always check `git remote get-url <remote>` for the specific remote you intend to act against, and pass `-R <remote>` between the subcommand group and the action (e.g. `fj pr -R upstream view 2`) so it lands on the right repo.
