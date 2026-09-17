import { ghApiJson } from "./gh.mts"

export interface DeployKeySummary {
  id: number
  title: string
  key: string
  read_only: boolean
}

export function listDeployKeys(owner: string, repo: string): DeployKeySummary[] {
  // --paginate follows every page; --slurp wraps the pages into an outer array (one sub-array
  // per page) rather than a flat list, hence the .flat().
  const pages = ghApiJson<DeployKeySummary[][]>([`repos/${owner}/${repo}/keys`, "--paginate", "--slurp"])
  return pages.flat()
}

/** The algorithm+base64 portion of a public key, ignoring the trailing comment GitHub itself drops. */
function keyMaterial(key: string): string {
  const [algorithm, base64] = key.trim().split(/\s+/)
  return `${algorithm ?? ""} ${base64 ?? ""}`
}

export function findDeployKeyByMaterial(owner: string, repo: string, publicKey: string): DeployKeySummary | undefined {
  const target = keyMaterial(publicKey)
  return listDeployKeys(owner, repo).find((existing) => keyMaterial(existing.key) === target)
}

export function addDeployKey(owner: string, repo: string, title: string, publicKey: string): DeployKeySummary {
  return ghApiJson<DeployKeySummary>([
    `repos/${owner}/${repo}/keys`,
    "-X",
    "POST",
    "-f",
    `title=${title}`,
    "-f",
    `key=${publicKey}`,
    "-F",
    "read_only=false",
  ])
}
