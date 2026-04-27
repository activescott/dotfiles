#!/bin/bash
# confirm-before-run.sh
# PreToolUse hook that prompts the user for confirmation before
# running specific commands. Add patterns to the array below.

# ── patterns that require confirmation ──────────────────────────
# Each entry is  pattern|||reason
# pattern is matched as a substring of the bash command.
patterns=(
  "git push|||because git push requires explicit user confirmation"
  "--no-gpg-sign|||because commits must be signed; --no-gpg-sign requires explicit user confirmation"
  "git commit|||because git commit requires explicit user confirmation"
  "kubectl --context nas|||because kubectl commands against the nas cluster require explicit user confirmation"
  "gh pr merge|||because this merges a PR and may delete the source branch; not reversible without force-push"
  "gh pr create|||because this creates a visible PR on GitHub that collaborators will be notified about"
  "gh api*--method|||because this can make non-GET requests to the GitHub API"
  "gh api*-X|||because this can make non-GET requests to the GitHub API"
  "gh api*--input|||because this can send a request body to the GitHub API (implies POST/PATCH)"
  "gh api*-f |||because this can send form fields to the GitHub API (implies POST)"
  "gh api*--field|||because this can send form fields to the GitHub API (implies POST)"
  "gh api*--raw-field|||because this can send form fields to the GitHub API (implies POST)"
  "gh api* -F |||because this can send form fields to the GitHub API (implies POST)"
  "gh release create|||because this publishes a release that may trigger deployment pipelines and notify watchers"
  "gh release delete|||because this permanently deletes a release and its associated assets"
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
