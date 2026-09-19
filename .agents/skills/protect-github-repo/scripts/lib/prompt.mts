import prompts from "prompts"
import { createInterface } from "node:readline"

/**
 * `_writeToOutput` is real but undocumented/private on Node's readline `Interface` — this is the
 * long-standing community technique for suppressing echo with core `readline` (no dependency).
 * Declared here via module augmentation (not an `as` cast) so pastedSecretPrompt below stays type
 * checked.
 */
declare module "node:readline" {
  interface Interface {
    _writeToOutput?(stringToWrite: string): void
  }
}

function assertInteractive(message: string, flagHint: string): void {
  if (!process.stdin.isTTY) {
    throw new Error(
      `refusing to prompt ("${message}") on non-interactive stdin — pass ${flagHint} explicitly instead`,
    )
  }
}

export async function confirmPrompt(message: string): Promise<boolean> {
  assertInteractive(message, "--overwrite-ruleset / --overwrite-codeowners / --skip-ruleset / --skip-codeowners")
  const response = await prompts({ type: "confirm", name: "value", message, initial: false })
  if (response.value === undefined) {
    throw new Error("prompt cancelled")
  }
  return response.value
}

export async function textPrompt(message: string, options: { initial?: string } = {}): Promise<string> {
  assertInteractive(message, "--deploy-key-file / --deploy-key-title")
  const response = await prompts({ type: "text", name: "value", message, initial: options.initial })
  if (!response.value) {
    throw new Error("prompt cancelled")
  }
  return response.value
}

/** Trailing line of a PEM/OpenSSH private-key block, e.g. "-----END OPENSSH PRIVATE KEY-----". */
const PRIVATE_KEY_TRAILER_PATTERN = /^-----END [A-Z0-9 ]*PRIVATE KEY-----\s*$/
const MAX_PASTED_LINES = 200

/**
 * Reads a pasted multi-line secret (e.g. an SSH private key) with terminal echo fully suppressed
 * — nothing appears on screen while typing or pasting, same as a `sudo` password prompt.
 *
 * This does NOT use the `prompts` package: its text/password prompts are single-line — they
 * submit on the very first newline and everything after it spills onto the raw terminal past the
 * library's control. Node's own `readline` doesn't have that limitation: its 'line' event fires
 * once per newline in a pasted chunk, in order, without dropping any — exactly what a multi-line
 * paste needs. Stops automatically at the key's own "-----END ... PRIVATE KEY-----" trailer line,
 * or on Ctrl+D (EOF) for key formats that don't end that way.
 */
export async function pastedSecretPrompt(message: string): Promise<string> {
  assertInteractive(message, "--deploy-key-private-key-file")
  process.stdout.write(`${message}\n`)
  return new Promise<string>((resolve, reject) => {
    const lines: string[] = []
    const rl = createInterface({ input: process.stdin, terminal: true, historySize: 0 })
    rl._writeToOutput = () => {}
    rl.on("line", (line) => {
      lines.push(line)
      if (PRIVATE_KEY_TRAILER_PATTERN.test(line.trim()) || lines.length >= MAX_PASTED_LINES) {
        rl.close()
      }
    })
    rl.on("close", () => {
      process.stdout.write("\n")
      const value = lines.join("\n").trim()
      if (!value) {
        reject(new Error("prompt cancelled"))
        return
      }
      resolve(`${value}\n`)
    })
  })
}

export async function multiselectPrompt(
  message: string,
  choices: Array<{ label: string; value: string; selected?: boolean }>,
  options: { flagHint?: string; zeroIsFine?: boolean } = {},
): Promise<string[]> {
  assertInteractive(message, options.flagHint ?? "--status-checks")
  const zeroIsFine = options.zeroIsFine ?? true
  const response = await prompts({
    type: "multiselect",
    name: "value",
    message,
    choices: choices.map((choice) => ({ title: choice.label, value: choice.value, selected: choice.selected })),
    instructions: false,
    hint: zeroIsFine
      ? "- space to select, return to submit, zero is fine"
      : "- space to select, return to submit",
  })
  if (response.value === undefined) {
    throw new Error("prompt cancelled")
  }
  return response.value
}
