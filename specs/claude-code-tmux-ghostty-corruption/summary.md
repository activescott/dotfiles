# Claude Code TUI corruption in tmux + Ghostty

## Symptom

Running `claude` inside tmux (Ghostty terminal, macOS) produced garbled
rendering: large blocks of text missing, and the screen appeared to scroll
and overwrite itself. Reproduced in both `"tui": "default"` and
`"tui": "fullscreen"` renderer modes. Did NOT reproduce running `claude`
directly in Ghostty outside tmux.

## Environment

- macOS (Darwin 25.3.0), Ghostty terminal
- tmux 3.7a, `TERM=tmux-256color`
- Claude Code installed two ways on this machine, which mattered a lot (see
  Root Cause):
  - Homebrew cask: `/opt/homebrew/Caskroom/claude-code/2.1.202`, symlinked at
    `/opt/homebrew/bin/claude`
  - npm global under nvm: `~/.nvm/versions/node/v22.21.1/lib/node_modules/@anthropic-ai/claude-code`,
    symlinked at `~/.nvm/versions/node/v22.21.1/bin/claude`
- `$PATH` puts the nvm bin dir *before* `/opt/homebrew/bin`, so the nvm
  install is what actually runs when you type `claude` — not brew's, even
  though brew is what the user thought they were managing.

## Root cause

Regression introduced in Claude Code **2.1.200**, which added
"synchronized terminal output" for tmux 3.4+ (changelog line: "Fixed
rendering flicker under tmux 3.4+ by enabling synchronized terminal
output"). This appears to interact badly with tmux + Ghostty specifically,
producing the corruption described above. Confirmed present through at
least **2.1.210** (latest available on npm at investigation time) — not yet
fixed upstream.

Bisected via npm side-installs (didn't touch the system install):

```sh
npm install @anthropic-ai/claude-code@2.1.199 --prefix ./v199
npm install @anthropic-ai/claude-code@2.1.210 --prefix ./v210
```

- `2.1.199` → clean, works fine in tmux+Ghostty
- `2.1.210` → still broken, same corruption

Ruled out (tried, no effect):
- `/tui fullscreen` vs `/tui default` — broken in both
- `~/.tmux.conf`: `set -as terminal-overrides ',*:Sync@'` (strip Sync
  terminfo capability) — no effect, reverted
- `~/.tmux.conf`: `set -g focus-events on` — unrelated fix for a different
  Claude Code nag message, didn't touch the corruption, kept it anyway since
  it's independently useful (Claude Code prompts for it)
- `CLAUDE_CODE_FORCE_SYNC_OUTPUT=1` — forces sync ON, was likely already
  auto-detected on; no diagnostic value since we needed to test OFF, and
  there is no shipped env var to force it off

## Fix applied (temporary, until upstream fix ships)

Pinned the npm-global copy (the one that actually wins in `$PATH`) to the
last known-good version:

```sh
npm install -g @anthropic-ai/claude-code@2.1.199
```

Verified: `claude --version` → `2.1.199 (Claude Code)`.

npm does not auto-update global packages on its own, so this stays pinned
until one of these runs: `npm update -g @anthropic-ai/claude-code`,
`npm install -g @anthropic-ai/claude-code@latest`, or Claude Code's own
`claude update` / in-app `/update` self-updater.

Gotcha hit while verifying: after pinning, `claude` still launched broken
once — turned out to be zsh's command-hash cache from earlier in the same
shell session pointing at the old resolved path. Fixed with `rehash` (zsh)
or by opening a fresh pane.

The homebrew cask install (`/opt/homebrew/bin/claude`, 2.1.202) was left
as-is — it's broken too (2.1.202 is in the bad range) but is shadowed by
the nvm install in `$PATH` so it doesn't matter day to day. Not fixed,
just irrelevant while the nvm copy is pinned ahead of it.

## To undo the pin once Anthropic ships a fix

```sh
npm install -g @anthropic-ai/claude-code@latest
```

Check the changelog (`~/.claude/cache/changelog.md`) for a fix mention
referencing tmux, Ghostty, or synchronized/sync output after 2.1.210
before unpinning.

## Bug report

Filed upstream: https://github.com/anthropics/claude-code/issues/77689
