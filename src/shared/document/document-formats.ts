import { extname } from "pathe"

export const ACCEPTED_DOCUMENT_FORMATS = ["pdf"] as const

/** Returns the lowercase extension without its leading dot. */
export function getDocumentExtension(fileName: string): string {
  return extname(fileName).slice(1).toLowerCase()
}
