const colorEnabled = process.stdout.isTTY === true && process.env.NO_COLOR === undefined

function wrap(code: string): (text: string) => string {
  return (text: string): string => (colorEnabled ? `\x1b[${code}m${text}\x1b[0m` : text)
}

export const bold = wrap("1")
export const dim = wrap("2")
export const green = wrap("32")
export const yellow = wrap("33")
export const red = wrap("31")
