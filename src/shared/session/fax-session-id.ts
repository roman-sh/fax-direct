const CROCKFORD_BASE32_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
const SESSION_ID_LENGTH = 12
const SESSION_ID_GROUP_LENGTH = 4

function formatSessionId(id: string): string {
  return id
    .match(new RegExp(`.{1,${SESSION_ID_GROUP_LENGTH}}`, "g"))!
    .join("-")
}

export function createFaxSessionId(): string {
  const randomBytes = crypto.getRandomValues(
    new Uint8Array(SESSION_ID_LENGTH)
  )
  const id = Array.from(
    randomBytes,
    (value) => CROCKFORD_BASE32_ALPHABET[value & 31]
  ).join("")

  return formatSessionId(id)
}

export function normalizeFaxSessionId(value: string): string | null {
  const id = value
    .trim()
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replaceAll("O", "0")
    .replace(/[IL]/g, "1")

  if (
    id.length !== SESSION_ID_LENGTH ||
    [...id].some(
      (character) => !CROCKFORD_BASE32_ALPHABET.includes(character)
    )
  ) {
    return null
  }

  return formatSessionId(id)
}
