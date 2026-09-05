# Plan: opencode user-scoped config

## Goal

Set up user-scoped opencode configuration that approximately matches the
existing claude-code config in this repo, using `AGENTS.md` as the
cross-harness standard and avoiding rule duplication between the two.

## Decisions

- **Caveman**: skill-only install (`npx skills add JuliusBrussee/caveman
  --skill '*' -a opencode --yes`). One-time per machine, content is
  downloaded.
- **AGENTS.md layout**: single source at `.agents/AGENTS.md`. claude-code
  reads `~/.claude/AGENTS.md` and `~/.claude/CLAUDE.md`, the latter a thin
  `@../.agents/AGENTS.md` shim. opencode doesn't symlink
  `~/.config/opencode/AGENTS.md`; instead `opencode.jsonc`'s `instructions`
  array points directly at `~/.agents/AGENTS.md`. Rules are NOT eagerly
  loaded; AGENTS.md indexes each rule with a one-line description and a
  markdown link to the full rule file, and explicitly tells the agent to use
  the Read tool to load the full rule only when in play. This keeps opencode's
  context window small.
- **Skills layout**: single source at `.agents/skills/<name>/SKILL.md`. opencode
  auto-discovers `~/.agents/skills/<name>` natively; claude-code only looks at
  `~/.claude/skills/`, so `setup_claude_dir` replaces the whole
  `~/.claude/skills` directory with a symlink to `~/.agents/skills`. Single
  symlink per profile instead of per-skill aliases.
- **Hook parity**: port `confirm-before-run.sh` to a TypeScript opencode plugin
  (`tool.execute.before` on the `bash` tool).
- **Model/small_model**: leave unset — opencode falls back to whatever
  provider the user `/connect`s to.
- **Format**: jsonc (`opencode.jsonc`).
- **claude-work profile**: skipped per user request.

## Files

### New
- `docs/specs/000-opencode-user-config/plan.md` — this file
- `docs/specs/000-opencode-user-config/summary.md` — written at completion
- `.agents/AGENTS.md` — moved from `.claude/AGENTS.md` (which itself moved from `.claude/CLAUDE.md`)
- `.agents/skills/<name>/SKILL.md` — moved from `.claude/skills/<name>/SKILL.md`
- `.agents/rules/*.md` — moved from `.claude/rules/*.md`
- `.config/opencode/opencode.jsonc` — opencode global config
- `.config/opencode/plugins/confirm-before-run.ts` — `tool.execute.before` plugin
- `.config/opencode/plugins/package.json` — `@opencode-ai/plugin` dep for types

### Modified
- `.claude/CLAUDE.md` → `@AGENTS.md` (one line)
- `script/setup` → add `setup_agents_dir()` (creates `~/.agents/skills/<name>`
  symlinks from the dotfiles source) and `setup_opencode_dir()`. `setup_claude_dir`'s
  skills loop now aliases from `~/.agents/skills/<name>` instead of from the
  dotfiles source directly. (Per-skill loop was later replaced with a single
  `~/.claude/skills` → `~/.agents/skills` whole-dir symlink.)
- `README.md` → short opencode section

> Source files live under `.config/opencode/` (not `.opencode/`) so this repo
> isn't treated as an opencode project — opencode walks up from cwd looking for
> `.opencode/` and would otherwise double-load the plugin (once globally, once
> as a project-level plugin).

## Symlinks created by `script/setup`

- `~/.agents/AGENTS.md` → `.agents/AGENTS.md` (set up by `setup_agents_dir`)
- `~/.agents/skills` → `.agents/skills` (whole-dir; set up by `setup_agents_dir`)
- `~/.agents/rules` → `.agents/rules` (whole-dir; set up by `setup_agents_dir`)
- `~/.claude/AGENTS.md` → `~/.agents/AGENTS.md` (alias; set up by `setup_claude_dir`)
- `~/.claude/skills` → `~/.agents/skills` (whole-dir; set up by `setup_claude_dir`)
- `~/.claude/rules` → `~/.agents/rules` (whole-dir; set up by `setup_claude_dir`)
- Same aliases under `~/.claude-work/` for the work profile.
- `~/.config/opencode/opencode.jsonc` → `.config/opencode/opencode.jsonc`
- `~/.config/opencode/plugins/confirm-before-run.ts` → `.config/opencode/plugins/confirm-before-run.ts`
- `~/.config/opencode/plugins/package.json` → `.config/opencode/plugins/package.json`
- `opencode.jsonc` `instructions` array references `~/.agents/AGENTS.md`
  directly — no `~/.config/opencode/AGENTS.md` symlink

## `.config/opencode/opencode.jsonc` (final)

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  // User-level opencode config; mirrored from .claude/settings.json where applicable.

  "lsp": true,

  "permission": {
    "bash": {
      "*": "ask",
      "sleep *": "allow",
      "gh pr view *": "allow",
      "gh pr checks *": "allow",
      "gh pr list *": "allow",
      "gh pr diff *": "allow",
      "gh run view *": "allow",
      "gh run list *": "allow",
      "gh run watch *": "allow",
      "gh search code *": "allow",
      "gh release list *": "allow",
      "gh release view *": "allow",
      "gh workflow list *": "allow"
    }
  },

  "mcp": {
    "tinkerbell-prod": {
      "type": "remote",
      "url": "https://tinkerbellbot.com/mcp",
      "oauth": {}
    },
    "grafana": {
      "type": "local",
      "command": ["mcp-grafana"],
      "enabled": true,
      "environment": {
        "GRAFANA_URL": "https://grafana.activescott.com/"
      }
    }
  },

  "instructions": [
    "~/.claude/rules/*.md"
  ]
}
```

The `instructions` array is what opencode uses to load per-rule context. It
mirrors what claude-code does by reading everything in `.claude/rules/`
automatically.

## `.config/opencode/plugins/confirm-before-run.ts`

Subscribes to `tool.execute.before`. When `input.tool === "bash"`, matches the
command against patterns ported from
`~/.claude/hooks/confirm-before-run.sh`:

- `--no-gpg-sign` → "commits must be signed; --no-gpg-sign requires explicit user confirmation"
- `gh api *{--method,-X,--input,-f,--field,--raw-field,-F}` → "can make non-GET requests to the GitHub API"
- `gh release create` → "publishes a release that may trigger deployment pipelines and notify watchers"
- `gh release delete` → "permanently deletes a release and its associated assets"

On match, throws `new Error(reason)`. opencode surfaces this as the tool
failure message in the TUI; functionally equivalent to claude's
`permissionDecisionReason` flow.

## Caveman (one-time per machine)

```
npx skills add JuliusBrussee/caveman --skill '*' -a opencode --yes
```

Lands at `~/.config/opencode/skills/caveman*/`; auto-discovered by opencode.
`script/setup` prints a reminder (not idempotent enough to run inline since it
downloads content).

## Verification

1. `opencode mcp list` → both `tinkerbell-prod` and `grafana` listed.
2. `opencode mcp auth tinkerbell-prod` → OAuth flow completes.
3. `opencode` launches; `skill` tool shows all 5 repo skills + any installed
   caveman skills.
4. Inside a TS file → LSP server attaches.
5. Bash call to `gh release create foo v1` → plugin throws with reason.
6. `cat ~/.claude/CLAUDE.md` shows only `@AGENTS.md`; claude-code still loads
   the rules via the symlinked `~/.claude/AGENTS.md`.

## Out of scope

- `settings.local.json` parity (machine-local, not in repo).
- claude-work profile (skipped per user).
- Plugin auto-approve exact-match sleep strings (redundant — `sleep *` is
  allow-listed at config layer).
- Custom opencode agents/commands/themes (none in claude config).
