import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

export function backupDirFor(owner: string, repo: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  return join(process.cwd(), ".protect-github-repo-backups", `${owner}-${repo}`, timestamp)
}

export function writeBackup(dir: string, filename: string, content: string): string {
  mkdirSync(dir, { recursive: true })
  const path = join(dir, filename)
  writeFileSync(path, content, "utf8")
  return path
}
