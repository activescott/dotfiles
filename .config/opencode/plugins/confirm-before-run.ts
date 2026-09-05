import type { Plugin } from "@opencode-ai/plugin"

// Mirrors ~/.claude/hooks/confirm-before-run.sh — a PreToolUse hook that
// prompts the user for confirmation before running specific bash commands.
// In opencode we can't prompt-and-allow from a plugin, so the closest
// equivalent is to throw with the pattern's reason as the error message;
// opencode surfaces that to the TUI as the tool failure reason.

type ConfirmPattern = { match: RegExp; reason: string };

const patterns: ConfirmPattern[] = [
  {
    // commits must be signed; --no-gpg-sign requires explicit user confirmation
    match: /--no-gpg-sign/,
    reason: "commits must be signed; --no-gpg-sign requires explicit user confirmation",
  },
  {
    match: /\bgh\s+api\b.*--method\b/,
    reason: "this can make non-GET requests to the GitHub API",
  },
  {
    match: /\bgh\s+api\b.*\s-X\s/,
    reason: "this can make non-GET requests to the GitHub API",
  },
  {
    match: /\bgh\s+api\b.*--input\b/,
    reason: "this can send a request body to the GitHub API (implies POST/PATCH)",
  },
  {
    match: /\bgh\s+api\b.*\s-f\s/,
    reason: "this can send form fields to the GitHub API (implies POST)",
  },
  {
    match: /\bgh\s+api\b.*--field\b/,
    reason: "this can send form fields to the GitHub API (implies POST)",
  },
  {
    match: /\bgh\s+api\b.*--raw-field\b/,
    reason: "this can send form fields to the GitHub API (implies POST)",
  },
  {
    match: /\bgh\s+api\b.*\s-F\s/,
    reason: "this can send form fields to the GitHub API (implies POST)",
  },
  {
    match: /\bgh\s+release\s+create\b/,
    reason:
      "this publishes a release that may trigger deployment pipelines and notify watchers",
  },
  {
    match: /\bgh\s+release\s+delete\b/,
    reason: "this permanently deletes a release and its associated assets",
  },
];

const ConfirmBeforeRunPlugin: Plugin = async () => {
  return {
    "tool.execute.before": async (input, output) => {
      if (input.tool !== "bash") return;
      const command = output?.args?.command;
      if (typeof command !== "string" || command.length === 0) return;
      for (const { match, reason } of patterns) {
        if (match.test(command)) {
          throw new Error(reason);
        }
      }
    },
  };
};

export const ConfirmBeforeRun = ConfirmBeforeRunPlugin;
export default ConfirmBeforeRunPlugin;
