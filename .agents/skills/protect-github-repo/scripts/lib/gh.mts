import { spawnSync } from "node:child_process"

/**
 * Runs `gh api <args>` with the user's existing `gh` auth. Never touches
 * tokens directly so the caller's default auth (personal or work) is used.
 */
export function ghApi(args: string[], input?: string): string {
  const result = spawnSync("gh", ["api", ...args], { encoding: "utf8", input })
  if (result.error) {
    throw new Error(`failed to launch gh: ${result.error.message}`)
  }
  if (result.status !== 0) {
    throw new Error(
      `gh api ${args.join(" ")} failed (exit ${result.status}): ${result.stderr.trim()}`,
    )
  }
  return result.stdout
}

export function ghApiJson<T>(args: string[]): T {
  return JSON.parse(ghApi(args))
}

/**
 * Same as ghApiJson, but returns null instead of throwing when the lookup
 * simply has nothing to return: a 404 (no such resource), or a 409 with
 * "Git Repository is empty" (no commits yet, so e.g. no default-branch tip
 * to look up).
 */
export function ghApiJsonOrNull<T>(args: string[]): T | null {
  const result = spawnSync("gh", ["api", ...args], { encoding: "utf8" })
  if (result.status === 0) {
    return JSON.parse(result.stdout)
  }
  if (
    result.stderr.includes("HTTP 404") ||
    result.stderr.includes("Not Found") ||
    result.stderr.includes("Git Repository is empty")
  ) {
    return null
  }
  throw new Error(
    `gh api ${args.join(" ")} failed (exit ${result.status}): ${result.stderr.trim()}`,
  )
}

export function ghApiRaw(args: string[]): { status: number; stdout: string; stderr: string } {
  const result = spawnSync("gh", ["api", ...args], { encoding: "utf8" })
  return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr }
}
