import { Buffer } from "node:buffer"
import { ghApiJsonOrNull } from "./gh.mts"

/** Locations GitHub reads CODEOWNERS from, in the order it checks them. */
export const CODEOWNERS_PATHS = ["CODEOWNERS", ".github/CODEOWNERS", "docs/CODEOWNERS"]

export function buildCanonicalCodeowners(login: string): string {
  return `# Managed by the protect-github-repo skill.\n* @${login}\n`
}

export interface ExistingCodeowners {
  path: string
  sha: string
  content: string
}

interface ContentsResponse {
  path: string
  sha: string
  content: string
  encoding: string
}

export function findExistingCodeowners(owner: string, repo: string): ExistingCodeowners | null {
  for (const path of CODEOWNERS_PATHS) {
    const response = ghApiJsonOrNull<ContentsResponse>([`repos/${owner}/${repo}/contents/${path}`])
    if (response) {
      const content = Buffer.from(response.content, response.encoding === "base64" ? "base64" : "utf8").toString(
        "utf8",
      )
      return { path: response.path, sha: response.sha, content }
    }
  }
  return null
}
