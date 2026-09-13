import { isRecord } from "./ruleset.mts"

export interface DiffEntry {
  path: string
  expected: unknown
  actual: unknown
}

/** Labels an array element by its `type` field when present (e.g. rules[pull_request]), else by index. */
function arrayElementLabel(expected: unknown, actual: unknown, index: number): string {
  if (isRecord(expected) && typeof expected.type === "string") {
    return expected.type
  }
  if (isRecord(actual) && typeof actual.type === "string") {
    return actual.type
  }
  return String(index)
}

/** Recursively diffs two JSON-like values, collecting leaf-level differences. */
export function diffValues(expected: unknown, actual: unknown, path = ""): DiffEntry[] {
  if (isRecord(expected) && isRecord(actual)) {
    const keys = new Set([...Object.keys(expected), ...Object.keys(actual)])
    const diffs: DiffEntry[] = []
    for (const key of keys) {
      diffs.push(...diffValues(expected[key], actual[key], path ? `${path}.${key}` : key))
    }
    return diffs
  }
  if (Array.isArray(expected) && Array.isArray(actual)) {
    if (JSON.stringify(expected) === JSON.stringify(actual)) {
      return []
    }
    if (!expected.every(isRecord) || !actual.every(isRecord)) {
      return [{ path, expected, actual }]
    }
    const diffs: DiffEntry[] = []
    for (let index = 0; index < Math.max(expected.length, actual.length); index++) {
      const label = arrayElementLabel(expected[index], actual[index], index)
      diffs.push(...diffValues(expected[index], actual[index], `${path}[${label}]`))
    }
    return diffs
  }
  if (expected !== actual) {
    return [{ path, expected, actual }]
  }
  return []
}
