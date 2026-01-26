# Auto-detect git commit signing for 1Password (local vs remote)

## Problem
`.gitconfig` requires manually commenting/uncommenting include lines to switch between local macOS and remote SSH signing configs.

## Approach
Create a signing wrapper script that auto-detects the environment, then consolidate into a single include file.

### Files to create

1. **`bin/op-ssh-sign-wrapper`** — shell script:
   ```sh
   #!/bin/sh
   # Auto-detect: use 1Password locally on macOS, fall back to ssh-keygen on remote/Linux.
   if [ -z "$SSH_CONNECTION" ] && [ -x "/Applications/1Password.app/Contents/MacOS/op-ssh-sign" ]; then
       exec /Applications/1Password.app/Contents/MacOS/op-ssh-sign "$@"
   else
       exec ssh-keygen "$@"
   fi
   ```

### Files to modify

2. **`.gitconfig.commit-signing-1p.include`** — replace hardcoded 1Password path with `op-ssh-sign-wrapper`. Add comment explaining how to manually override (set `gpg.ssh.program` directly to a specific binary if needed).

3. **`.gitconfig`** — remove the commented-out `1p-remote` include line (no longer needed).

4. **`script/setup`** — remove the `cpsafe` line for `.gitconfig.commit-signing-1p-remote.include`.

### Files to delete

5. **`.gitconfig.commit-signing-1p-remote.include`** — no longer needed; the wrapper handles both cases.

## Verification
- On this Linux machine: `git commit` should use `ssh-keygen` (forwarded agent)
- On macOS local: wrapper detects 1Password and uses `op-ssh-sign`
