#!/bin/bash
# confirm-before-run.sh
# PreToolUse hook that prompts the user for confirmation before
# running specific commands. Add patterns to the array below.

# ── patterns that require confirmation ──────────────────────────
# Each entry is  pattern|||reason
# pattern is matched as a substring of the bash command.
patterns=(
  "git push|||git push requires explicit user confirmation"
  "--no-gpg-sign|||commits must be signed; --no-gpg-sign requires explicit user confirmation"
  "git commit|||git commit requires explicit user confirmation"
)

# ── hook logic (no changes needed below) ────────────────────────
command=$(jq -r '.tool_input.command' < /dev/stdin)

for entry in "${patterns[@]}"; do
  pattern="${entry%%|||*}"
  reason="${entry##*|||}"

  if [[ "$command" == *"$pattern"* ]]; then
    jq -n \
      --arg reason "$reason" \
      '{
        "hookSpecificOutput": {
          "hookEventName": "PreToolUse",
          "permissionDecision": "ask",
          "permissionDecisionReason": $reason
        }
      }'
    exit 0
  fi
done

exit 0
