export const RULESET_NAME = "protect-default-branch"

export interface RulesetOptions {
  bypassUserId: number
  requiredStatusCheckContexts: string[]
}

export interface RulesetRule {
  type: string
  parameters?: Record<string, unknown>
}

export interface RulesetPayload {
  name: string
  target: "branch"
  enforcement: "active"
  bypass_actors: Array<{ actor_id: number; actor_type: string; bypass_mode: string }>
  conditions: { ref_name: { include: string[]; exclude: string[] } }
  rules: RulesetRule[]
}

/**
 * Canonical repo-protection ruleset: PR required with code-owner review,
 * squash-only merges, no deletion/force-push, and only the named user can
 * bypass. Optionally requires status checks to pass and the branch to be
 * up to date, when the caller has confirmed which checks (if any) apply.
 */
export function buildCanonicalRuleset(options: RulesetOptions): RulesetPayload {
  const rules: RulesetRule[] = [
    {
      type: "pull_request",
      parameters: {
        required_approving_review_count: 1,
        dismiss_stale_reviews_on_push: false,
        required_reviewers: [],
        require_code_owner_review: true,
        require_last_push_approval: false,
        required_review_thread_resolution: false,
        require_extra_approval_for_unattributed_changes: true,
        allowed_merge_methods: ["squash"],
      },
    },
    { type: "deletion" },
    { type: "non_fast_forward" },
  ]

  if (options.requiredStatusCheckContexts.length > 0) {
    rules.push({
      type: "required_status_checks",
      parameters: {
        required_status_checks: options.requiredStatusCheckContexts.map((context) => ({
          context,
        })),
        strict_required_status_checks_policy: true,
      },
    })
  }

  return {
    name: RULESET_NAME,
    target: "branch",
    enforcement: "active",
    bypass_actors: [{ actor_id: options.bypassUserId, actor_type: "User", bypass_mode: "always" }],
    conditions: { ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] } },
    rules,
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

/** Reads the check contexts an existing ruleset already requires, if any. */
export function extractRequiredStatusCheckContexts(ruleset: Record<string, unknown>): string[] {
  const rules = ruleset.rules
  if (!Array.isArray(rules)) {
    return []
  }
  const contexts: string[] = []
  for (const rule of rules) {
    if (!isRecord(rule) || rule.type !== "required_status_checks") {
      continue
    }
    const parameters = rule.parameters
    if (!isRecord(parameters)) {
      continue
    }
    const checks = parameters.required_status_checks
    if (!Array.isArray(checks)) {
      continue
    }
    for (const check of checks) {
      if (isRecord(check) && typeof check.context === "string") {
        contexts.push(check.context)
      }
    }
  }
  return contexts
}

const METADATA_KEYS = new Set([
  "id",
  "created_at",
  "updated_at",
  "_links",
  "current_user_can_bypass",
  "node_id",
  "source_type",
  "source",
])

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep)
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    return Object.fromEntries(entries.map(([key, entryValue]) => [key, sortKeysDeep(entryValue)]))
  }
  return value
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value))
}

export function stripRulesetMetadata(ruleset: Record<string, unknown>): Record<string, unknown> {
  const stripped: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(ruleset)) {
    if (!METADATA_KEYS.has(key)) {
      stripped[key] = value
    }
  }
  return stripped
}

/**
 * Drops the `required_status_checks` rule, since which checks (if any) are
 * required is a separate, repo-specific decision reported on its own via
 * extractRequiredStatusCheckContexts.
 */
export function withoutStatusChecksRule(ruleset: Record<string, unknown>): Record<string, unknown> {
  const rules = ruleset.rules
  const coreRules = Array.isArray(rules)
    ? rules.filter((rule) => !isRecord(rule) || rule.type !== "required_status_checks")
    : rules
  return { ...ruleset, rules: coreRules }
}

/** Whether `ruleset` already has a `DeployKey` bypass actor (any write-access deploy key bypasses). */
export function hasDeployKeyBypassActor(ruleset: Record<string, unknown>): boolean {
  const actors = ruleset.bypass_actors
  if (!Array.isArray(actors)) {
    return false
  }
  return actors.some((actor) => isRecord(actor) && actor.actor_type === "DeployKey")
}

/**
 * Drops any `DeployKey` bypass actor, since whether one is present is a separate, repo-specific
 * decision (added additively via `withDeployKeyBypassActor`, reported on its own via
 * `hasDeployKeyBypassActor`) rather than part of the canonical core comparison.
 */
export function withoutDeployKeyBypassActor(ruleset: Record<string, unknown>): Record<string, unknown> {
  const actors = ruleset.bypass_actors
  const coreActors = Array.isArray(actors)
    ? actors.filter((actor) => !isRecord(actor) || actor.actor_type !== "DeployKey")
    : actors
  return { ...ruleset, bypass_actors: coreActors }
}

/** Returns a copy of `ruleset` with a `DeployKey` bypass actor appended, unless it already has one. */
export function withDeployKeyBypassActor(ruleset: Record<string, unknown>): Record<string, unknown> {
  if (hasDeployKeyBypassActor(ruleset)) {
    return ruleset
  }
  const actors = Array.isArray(ruleset.bypass_actors) ? ruleset.bypass_actors : []
  return {
    ...ruleset,
    bypass_actors: [...actors, { actor_id: null, actor_type: "DeployKey", bypass_mode: "always" }],
  }
}

export function rulesetCoreMatches(
  existing: Record<string, unknown>,
  canonicalWithoutStatusChecks: RulesetPayload,
): boolean {
  const core = withoutDeployKeyBypassActor(withoutStatusChecksRule(stripRulesetMetadata(existing)))
  return stableStringify(core) === stableStringify(canonicalWithoutStatusChecks)
}
