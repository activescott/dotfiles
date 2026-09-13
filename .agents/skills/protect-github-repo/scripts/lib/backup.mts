import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

// Anchored to this file's directory (scripts/), not process.cwd(), so backups always land
// under scripts/.protect-github-repo-backups/ regardless of where the script was invoked from —
// that's the directory .gitignore already covers.
const SCRIPTS_DIR = dirname(dirname(fileURLToPath(import.meta.url)))

export function backupDirFor(owner: string, repo: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  return join(SCRIPTS_DIR, ".protect-github-repo-backups", `${owner}-${repo}`, timestamp)
}

export function writeBackup(dir: string, filename: string, content: string): string {
  mkdirSync(dir, { recursive: true })
  const path = join(dir, filename)
  writeFileSync(path, content, "utf8")
  return path
}
