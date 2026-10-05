import { extname } from "pathe"

export const ACCEPTED_DOCUMENT_FORMATS = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
} as const

/** Returns the lowercase extension without its leading dot. */
export function getDocumentExtension(fileName: string): string {
  return extname(fileName).slice(1).toLowerCase()
}
