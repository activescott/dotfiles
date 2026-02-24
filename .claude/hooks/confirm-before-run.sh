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
  "kubectl --context nas|||kubectl commands against the nas cluster require explicit user confirmation"
)

# ── commands that are auto-approved ───────────────────────────
# Each entry is matched as an exact command string.
auto_approve=(
  'sleep $((RANDOM % 10 + 1))'
  'sleep $((RANDOM % 3 + 1))'
)

# ── hook logic (no changes needed below) ────────────────────────
command=$(jq -r '.tool_input.command' < /dev/stdin)

for allowed in "${auto_approve[@]}"; do
  if [[ "$command" == "$allowed" ]]; then
    jq -n '{
      "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "allow",
        "permissionDecisionReason": "auto-approved by hook"
      }
    }'
    exit 0
  fi
done

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
