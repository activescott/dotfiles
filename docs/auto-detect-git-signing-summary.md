# Auto-detect git commit signing — Implementation Summary

## What was done

Replaced the manual `.gitconfig` include toggling (between local and remote signing configs) with a single auto-detecting wrapper script.

### Created
- **`bin/op-ssh-sign-wrapper`** — POSIX shell script that checks `$SSH_CONNECTION` and the presence of the 1Password binary to decide which signing program to use:
  - Local macOS with 1Password installed: uses `/Applications/1Password.app/Contents/MacOS/op-ssh-sign`
  - Remote SSH session or Linux: uses `ssh-keygen` (relies on forwarded SSH agent from `.ssh/config`)

### Modified
- **`.gitconfig.commit-signing-1p.include`** — `gpg.ssh.program` now points to `op-ssh-sign-wrapper` instead of the hardcoded 1Password macOS path. Added comments cross-referencing `.ssh/config` for agent forwarding.
- **`.gitconfig`** — Removed the commented-out `1p-remote` include line (no longer needed).
- **`script/setup`** — Removed the `cpsafe` line that deployed the now-deleted remote include file.
- **`.ssh/config`** — Added a cross-reference comment pointing to `bin/op-ssh-sign-wrapper` for git commit signing.

### Deleted
- **`.gitconfig.commit-signing-1p-remote.include`** — Fully replaced by the wrapper script.

## Verification
- Tested on the Linux remote machine: wrapper correctly invokes `ssh-keygen`.
- On macOS with 1Password installed: wrapper will detect and use the 1Password binary (not testable from this machine, but logic is straightforward).
