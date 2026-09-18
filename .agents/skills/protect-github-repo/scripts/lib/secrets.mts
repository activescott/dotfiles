import { closeSync, openSync } from "node:fs"
import { spawnSync } from "node:child_process"

export type SecretApp = "actions" | "dependabot"

/** Secret *names* only — gh never returns values, so this is safe to print/log. */
export function listSecretNames(owner: string, repo: string, app: SecretApp): string[] {
  const endpoint = app === "actions" ? "actions/secrets" : "dependabot/secrets"
  const result = spawnSync("gh", ["api", `repos/${owner}/${repo}/${endpoint}`, "--paginate", "--slurp"], {
    encoding: "utf8",
  })
  if (result.error) {
    throw new Error(`failed to launch gh: ${result.error.message}`)
  }
  if (result.status !== 0) {
    throw new Error(`gh api repos/${owner}/${repo}/${endpoint} failed (exit ${result.status}): ${result.stderr.trim()}`)
  }
  const pages: Array<{ secrets: Array<{ name: string }> }> = JSON.parse(result.stdout)
  return pages.flatMap((page) => page.secrets.map((secret) => secret.name))
}

/**
 * Uploads filePath's contents as a secret value via `gh secret set`, which encrypts client-side
 * before sending. The file is wired directly to the child process's stdin (an open fd, not a JS
 * string) so the secret's bytes never pass through this script's own memory or logging.
 */
export function setSecretFromFile(owner: string, repo: string, name: string, filePath: string, app: SecretApp): void {
  const fd = openSync(filePath, "r")
  try {
    const result = spawnSync("gh", ["secret", "set", name, "--repo", `${owner}/${repo}`, "--app", app], {
      stdio: [fd, "pipe", "pipe"],
      encoding: "utf8",
    })
    if (result.error) {
      throw new Error(`failed to launch gh: ${result.error.message}`)
    }
    if (result.status !== 0) {
      throw new Error(`gh secret set ${name} --app ${app} failed (exit ${result.status}): ${result.stderr.trim()}`)
    }
  } finally {
    closeSync(fd)
  }
}

/**
 * Same as setSecretFromFile, but for a value already in memory (e.g. read via pastedSecretPrompt)
 * rather than a file on disk.
 */
export function setSecretFromValue(owner: string, repo: string, name: string, value: string, app: SecretApp): void {
  const result = spawnSync("gh", ["secret", "set", name, "--repo", `${owner}/${repo}`, "--app", app], {
    input: value,
    encoding: "utf8",
  })
  if (result.error) {
    throw new Error(`failed to launch gh: ${result.error.message}`)
  }
  if (result.status !== 0) {
    throw new Error(`gh secret set ${name} --app ${app} failed (exit ${result.status}): ${result.stderr.trim()}`)
  }
}
