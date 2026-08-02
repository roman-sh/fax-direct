const CROCKFORD_BASE32_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
const SESSION_CODE_LENGTH = 12
const SESSION_CODE_GROUP_LENGTH = 4

function formatSessionCode(code: string): string {
  return code
    .match(new RegExp(`.{1,${SESSION_CODE_GROUP_LENGTH}}`, "g"))!
    .join("-")
}

export function createFaxSessionCode(): string {
  const randomBytes = crypto.getRandomValues(
    new Uint8Array(SESSION_CODE_LENGTH)
  )
  const code = Array.from(
    randomBytes,
    (value) => CROCKFORD_BASE32_ALPHABET[value & 31]
  ).join("")

  return formatSessionCode(code)
}

export function normalizeFaxSessionCode(value: string): string | null {
  const code = value
    .trim()
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replaceAll("O", "0")
    .replace(/[IL]/g, "1")

  if (
    code.length !== SESSION_CODE_LENGTH ||
    [...code].some(
      (character) => !CROCKFORD_BASE32_ALPHABET.includes(character)
    )
  ) {
    return null
  }

  return formatSessionCode(code)
}
