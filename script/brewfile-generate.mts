#!/usr/bin/env -S npx tsx
import { exec as execCallbacks } from "child_process"
import { promisify } from "util"
import { join, dirname } from "path"
import { writeFile } from "fs/promises"
const exec = promisify(execCallbacks)

const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
const thisdir = dirname(new URL(import.meta.url).pathname)
const TEMP_BREWFILE = `/tmp/Brewfile-${timestamp}.tmp`

// get manually installed formulas:
console.log("Getting manually installed formulas...")
const manuallyInstalledStr = (await exec(`brew leaves -r`)).stdout
const manuallyInstalled = manuallyInstalledStr.split("\n").filter(Boolean)

console.log("Manually installed formulas: ", manuallyInstalled.join(", "))

// Generate Brewfile
console.log("Generating Brewfile...")
const brewfileStr = (
  await exec(
    `brew bundle dump --force --formula --cask --tap --mas --describe --file=-`
  )
).stdout

let brewfileLines = brewfileStr.split("\n").filter(Boolean)

// remove the formulas that aren't manually installed (but ignore cask and mas, so only brew formulas)
const manuallyInstalledSet = new Set(manuallyInstalled)

for (let i = 0; i < brewfileLines.length; i++) {
  const line = brewfileLines[i]
  if (line.startsWith("#")) {
    continue
  }
  const [type, rawName] = line.split(" ")
  if (type !== "brew") {
    continue
  }
  // remove surrounding quotes on the name:
  const unquoted = rawName.replace(/^"(.*)"$/, "$1")
  // remove @ site in the middle for the version:
  const name = unquoted.split("@")[0]

  if (manuallyInstalledSet.has(name)) {
    continue
  }

  console.log(
    `Excluding ${name} from Brewfile as it's not manually installed...`
  )
  // remove it the comment line before the formula and the formula itself:
  brewfileLines.splice(i - 1, 2)
  i -= 2
}

// Create header content
const headerContent = `##################################################
# install with
# script/brewfile-install.sh (i.e. brew bundle install)
# 
# regen with:
# script/brewfile-generate.mts (i.e. brew bundle dump and some filtering...)
#
# cleanup homebrew-installed shite with:
# script/brewfile-cleanup-apps.sh (i.e. brew bundle --cleanup)
##################################################
`

// Read temp Brewfile and combine with header
const finalContent = headerContent + brewfileLines.join("\n")

// Write to final location
const brewFilePath = join(thisdir, "..", "Brewfile")
await writeFile(brewFilePath, finalContent)

console.log(`Brewfile generated successfully at ${brewFilePath}`)
