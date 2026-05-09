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
  - `skills/<name>/SKILL.md` — global skills
  - `commands/<name>.md` — global slash commands
  - `agents/<name>.md` — global subagents
- `script/setup` — installer (see below)
- Top-level dotfiles: `.bashrc`, `.bash_profile`, `.zshrc`, `.zprofile`, `.shrc`, `.inputrc`, `.gitconfig` + signing includes, `.bash_secrets`

## How `script/setup` installs

It symlinks (not copies, despite the name) sources from this repo into `~/`:

- `cpsafe SRC DST` — if `DST` is an existing symlink, removes it; if a real file, renames to `DST.old-<timestamp>`; then `ln -s SRC DST`.
- `cpsafe_dir SRCDIR DSTDIR` — `mkdir -p DSTDIR`, then `cpsafe` each file in `SRCDIR`.
- For `.claude/skills/`, the script symlinks each **skill directory** (not individual files) into `~/.claude/skills/<name>`.
- The `.claude/CLAUDE.md`, `.claude/settings.json`, and `.claude/hooks/confirm-before-run.sh` are individually symlinked, so editing them in this repo edits the live globals.
- On macOS, sets Terminal.app's `useOptionAsMetaKey` so Option+Backspace works as backward-kill-word.

Re-running `setup` is safe: existing symlinks are replaced, real files are backed up with a timestamp.

## Conventions

- Shell scripts use POSIX `sh` where possible; lowercase variable names for new vars.
- Commit signing: **1Password SSH is the active signer**. OnlyKey has been retired; the OnlyKey-related files (`bin/onlykey-git-sign-commit`, `.gitconfig.commit-signing-onlykey.include`, OnlyKey notes in `README.md`) are kept only for reference / in case an OnlyKey-bound key resurfaces. Do not assume OnlyKey is in use.
- Brewfile workflow lives in `script/brewfile-*` (generate, install, check, cleanup-apps).
