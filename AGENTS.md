# dotfiles

Personal dotfiles for zsh/bash on macOS and Linux.

## Layout

- `bin/` — scripts that get linked to `~/bin/`
- `lib/` — libraries (e.g. `git-prompt.sh`) linked to `~/lib/`
- `.config/` — XDG config (mc, 1Password ssh, k9s); k9s is special-cased to `~/Library/Application Support/k9s` on macOS
- `.ssh/` — `config`, `authorized_keys`, `allowed_signers`
- `.claude/` — **special: this directory is symlinked to `~/.claude/` and acts as the user-scoped global Claude Code config.** Anything here applies globally across all projects.
  - `CLAUDE.md` — global instructions (the user-scoped CLAUDE.md)
  - `settings.json` — global Claude Code settings
  - `hooks/` — global hooks
- `.agents/` — shared cross-harness source for items both Claude and opencode use. `script/setup` symlinks each tool's own discovery path to the matching subdir here, so the canonical source lives in one place.
  - `skills/<name>/SKILL.md` — global skills (shared by Claude and opencode)
  - `rules/<name>.md` — long-form rules (shared by Claude and opencode); the rules index lives in `AGENTS.md`
  - `commands/<name>.md` — global slash commands (shared by Claude and opencode)
- `script/setup` — installer (see below)
- Top-level dotfiles: `.bashrc`, `.bash_profile`, `.zshrc`, `.zprofile`, `.shrc`, `.inputrc`, `.gitconfig` + signing includes, `.bash_secrets`
- This dotfiles repo's `.claude/` directory is symlinked to `~/.claude/`. The `.claude/skills/`, `.claude/rules/`, and `.claude/commands/` paths inside it are symlinks to their `.agents/` counterparts so Claude Code sees the shared set.

## How `script/setup` installs

It symlinks (not copies, despite the name) sources from this repo into `~/`:

- `cpsafe SRC DST` — if `DST` is an existing symlink, removes it; if a real file, renames to `DST.old-<timestamp>`; then `ln -s SRC DST`.
- `cpsafe_dir SRCDIR DSTDIR` — `mkdir -p DSTDIR`, then `cpsafe` each file in `SRCDIR`.
- `setup_agents_dir` symlinks whole dirs (`skills`, `rules`, `commands`) from the repo into `~/.agents/`; `setup_claude_dir` symlinks `~/.claude/skills|rules|commands` to their `~/.agents/` counterparts.
- The `.claude/CLAUDE.md`, `.claude/settings.json`, and `.claude/hooks/confirm-before-run.sh` are individually symlinked, so editing them in this repo edits the live globals.
- `setup_claude_dir <dir>` does all the Claude symlinking, and runs twice: for `~/.claude` (personal) and `~/.claude-work` (see below).
- On macOS, sets Terminal.app's `useOptionAsMetaKey` so Option+Backspace works as backward-kill-word.

Re-running `setup` is safe: existing symlinks are replaced, real files are backed up with a timestamp.

**Never** run one-off `ln`, `mkdir`, `cp`, or `mv` commands that touch `$HOME` directly — including `~/.claude/`, `~/bin/`, `~/lib/`, etc. Always add the source under this repo, update `script/setup` if the new path isn't covered by an existing loop, then run `script/setup`. This keeps `$HOME` reproducible from the repo and avoids hand-placed files that drift out of sync.

## Claude Code account profiles

Two Claude Code accounts live side by side, selected by the `CLAUDE_CONFIG_DIR`
environment variable:

| Profile  | Config dir       | How to launch                        |
| -------- | ---------------- | ------------------------------------ |
| personal | `~/.claude`      | `claude` (default, env var unset)     |
| work     | `~/.claude-work` | `claude-work` (from `bin/claude-work`) |

`CLAUDE_CONFIG_DIR` is the only knob needed. Claude Code resolves its config dir
as `process.env.CLAUDE_CONFIG_DIR ?? ~/.claude`, and derives from it:

- the global state file — `<dir>/.config.json` if present, otherwise
  `$CLAUDE_CONFIG_DIR/.claude.json` (falling back to `~/.claude.json` when the var
  is unset). This is why `~/.claude.json` sits in `$HOME` today rather than inside
  `~/.claude`.
- `<dir>/.credentials.json`, plus a macOS Keychain item named
  `Claude Code-credentials-<sha8>` where `sha8` is the first 8 hex characters of
  `sha256(<dir>)`. Profiles therefore do not share Keychain credentials.
- `<dir>/projects`, `history.jsonl`, `sessions`, `todos`, `shell-snapshots`.

Older multi-account guides that copy `~/.claude` and move a `~/.claude/.claude.json`
out of the way are obsolete — just create the directory and log in with the env var
set, which `script/setup` plus `bin/claude-work` do. The setup is adapted from
<https://docs.runmaestro.ai/multi-claude>.

Caveat: the Claude Code background daemon is disabled whenever `CLAUDE_CONFIG_DIR`
is set, so background jobs are unavailable in the work profile.

## Conventions

- Shell scripts use POSIX `sh` where possible; lowercase variable names for new vars.
- Commit signing: **1Password SSH is the active signer**. OnlyKey has been retired; the OnlyKey-related files (`bin/onlykey-git-sign-commit`, `.gitconfig.commit-signing-onlykey.include`, OnlyKey notes in `README.md`) are kept only for reference / in case an OnlyKey-bound key resurfaces. Do not assume OnlyKey is in use.
- Brewfile workflow lives in `script/brewfile-*` (generate, install, check, cleanup-apps).
