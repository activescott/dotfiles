---
description: Allow a bash command pattern in both Claude and opencode user-scoped configs
---

Allow the given bash command pattern as a pre-authorized command in BOTH user-scoped configs:

- `~/.claude/settings.json` (Claude Code)
- `~/.config/opencode/opencode.jsonc` (opencode)

The command pattern to allow: $ARGUMENTS

## Before editing

1. If `$ARGUMENTS` is empty or only whitespace, ask me for the pattern. Don't guess.
2. Judge whether the pattern is **clearly safe** for an agent to run unattended. If yes, proceed straight to editing without confirmation. If not, warn me about which specific concern tripped the safety check (which verb, which prefix risk, etc.), show the exact lines you plan to add to each file, and wait for my approval before editing.

A pattern is clearly safe when it matches all of:

- It's a read-only or local-only operation (`git status`, `git log`, `git diff`, `grep`, `tail`, `cat`, `ls`, `find` without `-delete`, `npm test`, `npm run typecheck`, `npx eslint`, `go test`, etc.).
- It does not contain a destructive or state-mutating verb: `rm`, `mv`, `cp` outside `/tmp`, `chmod`, `chown`, `dd`, `kill`, `drop`, `delete`, `push`, `merge`, `create`, `publish`, `apply`, `destroy`, `deploy`, `exec`, `send`, `post`, `put`, `patch`.
- It does not match an obviously broad prefix (a single bare word that could prefix-match many unrelated commands, or any pattern containing `*` on its own).
- It targets a known dev tool or local CLI the user already uses, not a system binary like `sudo`, `su`, `shutdown`, `reboot`, `mount`, `umount`.

Anything that fails any of these checks → warn with the specific reason, then ask. When in doubt, warn and ask.

## What to add

Rule formats differ between the two configs.

**Claude** (`~/.claude/settings.json`) — append to the `permissions.allow` array:

```
  "Bash(<pattern>:*)",
```

Claude Code's `:*)` suffix matches both no-args and with-args forms, so a single rule covers both.

**opencode** (`~/.config/opencode/opencode.jsonc`) — append to the `permission.bash` map:

```
      "<pattern>": "allow",
      "<pattern> *": "allow",
```

opencode needs two entries: the bare pattern for no-args, and `<pattern> *` (with a leading space, then wildcard) for with-args. The trailing space avoids accidental prefix matches (e.g. a `sleep` rule must not also allow `sleeping`). The existing config follows this for `sleep`, `gh pr checks`, etc.; some `git` rules use the looser `<pattern>*` form, but prefer the narrower two-rule form for new entries.

**Specificity**: opencode resolves bash permission rules by most-specific-match-wins, with last-defined breaking ties (per the [opencode docs](https://opencode.ai/docs/config#permissions)). A more specific rule always overrides a broader one regardless of order in the map — e.g. `"find *": "allow"` plus `"find * -exec *": "ask"` lets plain `find` through but prompts for `find * -exec *`. For ties (two equally specific rules), the later one wins. To layer an override, just add the narrower rule; position only matters when specificities are equal.

### Blocking unsafe variants

When a pattern is unsafe because one variant is destructive (e.g. `sed -i` rewrites files in place), allow the safe forms and deny the unsafe ones — both tools support layered allow + deny rules.

**Claude** — add a `permissions.deny` array alongside `allow` (create it if absent):

```
"deny": [
  "Bash(<tool> -<unsafe-flag>*:*)",
  "Bash(<tool> --<unsafe-long-flag>*:*)"
]
```

Deny rules short-circuit the check before `allow` is consulted. Use middle `*` as a glob wildcard — `Bash(sed -i*:*)` matches `sed -i`, `sed -i.bak`, `sed -iXXX`.

**opencode** — append deny entries to `permission.bash` AFTER the allow entries for the same tool (last matching rule wins, so the later deny overrides the earlier allow). Add both the bare and ` *` forms, mirroring the allow convention — the bare form covers the flag with no further args:

```
"<tool> -<unsafe-flag>*": "deny",
"<tool> -<unsafe-flag>* *": "deny",
"<tool> --<unsafe-long-flag>*": "deny",
"<tool> --<unsafe-long-flag>* *": "deny"
```

**Example (sed)** — allow read-only transforms, block in-place edits:

| File                                  | Allow             | Deny                                                              |
| ------------------------------------- | ----------------- | ----------------------------------------------------------------- |
| `~/.claude/settings.json`             | `"Bash(sed:*)"`   | `"Bash(sed -i*:*)"`, `"Bash(sed --in-place*:*)"`                  |
| `~/.config/opencode/opencode.jsonc`   | `"sed"` + `"sed *"` | `"sed -i*"`, `"sed -i* *"`, `"sed --in-place*"`, `"sed --in-place* *"` (placed after the allow entries) |

If a rule for the pattern already exists in either file (search for `Bash(<pattern>:` in Claude, and `<pattern>` as a JSON key in opencode), tell me and stop — don't duplicate.

## Steps

1. Use Read on both files to load the current contents. Both are symlinks into the dotfiles repo, so editing them is the same as editing the repo files — no separate `script/setup` re-run is needed, just commit.
2. Check both files for an existing entry for the pattern. If found in either file, report which one and stop.
3. Show me the exact lines you plan to add to each file and wait for my approval.
4. Use Edit on each file to insert the new lines right before the closing `]` (Claude) or `}` (opencode). Match existing indentation: 2 spaces inside the array, 6 spaces inside the nested map.
5. Re-read both files and confirm the additions landed at the end.
6. Remind me to commit the changes (`script/setup` not required — the symlinks already point at the repo files).

## Notes

- Use `~/.claude/settings.json` and `~/.config/opencode/opencode.jsonc` (the symlinked paths) rather than repo-relative paths so this works regardless of cwd.
- Patterns must not contain `:`, `*`, `"`, `\\`, or newlines. If the user passes anything exotic, push back.
- This command edits user-scoped config files (the catch-all `*` defaults to `ask` in both configs, so be conservative — only allow commands you've seen the user actually run).