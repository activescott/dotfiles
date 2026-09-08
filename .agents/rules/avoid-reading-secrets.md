---
name: avoid-reading-secrets
description: Do not read secrets or passwords into model context (.env, keys, decrypted plaintext)
metadata:
  type: feedback
---

Do not read secrets, passwords, or other credentials into model context.

**Why:** Anything printed by Read, Bash, or query tools lands in the transcript,
where it can leak into logs, summaries, snapshots, or follow-up tool calls.
Once a plaintext secret is in context it cannot be taken back.

**How to apply:**

- Never Read, cat, or grep the values out of files likely to hold secrets:
  `.env`, `.env.*`, `*.pem`, `*.key`, `id_rsa` / `id_ed25519`,
  `credentials.json` / `.credentials.json`, `secrets.yaml`, `.bash_secrets`,
  `.netrc`, `.aws/credentials`, 1Password / vault exports, or similar. If you
  must confirm such a file exists or has the right shape, use metadata only
  (`ls`, key names without values such as `cut -d= -f1 .env`, JSON key lists
  via `jq 'keys'`), and say why the values are not needed.
- Never decrypt a secret to plaintext just to confirm decryption works
  (`sops decrypt`, `age --decrypt`, `gpg -d`, `openssl enc -d`, `op read`,
  `vault kv get`, `gh secret list` values, etc.). Verifying by printing the
  plaintext puts the sensitive value into context — the exact harm to avoid.
  Instead verify without revealing: check exit status, decrypt to a redacted
  check (e.g. confirm byte count or a checksum against a known value), use the
  tool's metadata / fingerprint subcommand, or ask the user to verify on their
  side and report back.
- Same for process environment: avoid bare `env`, `printenv` (no args), or
  `set` dumps. Only query a single variable when the task requires it, and
  prefer not to echo its value in summaries or comments.
- If the user explicitly asks you to read or print a secret, prefer a
  non-revealing alternative first; only proceed with the values on explicit
  instruction, and never repeat them in summaries, commit messages, PR bodies,
  annotations, or snapshots.
