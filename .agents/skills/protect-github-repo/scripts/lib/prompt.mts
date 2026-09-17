import prompts from "prompts"

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

export async function multiselectPrompt(
  message: string,
  choices: Array<{ label: string; value: string }>,
): Promise<string[]> {
  assertInteractive(message, "--status-checks")
  const response = await prompts({
    type: "multiselect",
    name: "value",
    message,
    choices: choices.map((choice) => ({ title: choice.label, value: choice.value })),
    instructions: false,
    hint: "- space to select, return to submit, zero is fine",
  })
  if (response.value === undefined) {
    throw new Error("prompt cancelled")
  }
  return response.value
}
