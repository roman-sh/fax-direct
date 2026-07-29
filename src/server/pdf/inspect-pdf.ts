import "server-only"

import { getDocumentProxy } from "unpdf"
import {
  PasswordException,
  PasswordResponses,
  type PDFDocumentProxy,
} from "unpdf/pdfjs"

export type PdfInspectionErrorCode =
  | "ENCRYPTED_PDF"
  | "EMPTY_PDF"
  | "INVALID_PDF"
  | "TOO_MANY_PAGES"

export class PdfInspectionError extends Error {
  constructor(
    readonly code: PdfInspectionErrorCode,
    message: string
  ) {
    super(message)
    this.name = "PdfInspectionError"
  }
}

export async function inspectPdf(
  bytes: Uint8Array,
  maxPages: number
): Promise<{ pageCount: number }> {
  let document: PDFDocumentProxy

  try {
    document = await getDocumentProxy(bytes)
  } catch (error) {
    if (
      error instanceof PasswordException &&
      (error.code === PasswordResponses.NEED_PASSWORD ||
        error.code === PasswordResponses.INCORRECT_PASSWORD)
    ) {
      throw new PdfInspectionError(
        "ENCRYPTED_PDF",
        "לא ניתן לשלוח קובץ PDF שדורש סיסמה לפתיחה."
      )
    }

    throw new PdfInspectionError(
      "INVALID_PDF",
      "לא הצלחנו לקרוא את קובץ ה-PDF."
    )
  }

  const pageCount = document.numPages

  try {
    if (pageCount === 0) {
      throw new PdfInspectionError(
        "EMPTY_PDF",
        "קובץ ה-PDF אינו מכיל עמודים."
      )
    }

    if (pageCount > maxPages) {
      throw new PdfInspectionError(
        "TOO_MANY_PAGES",
        `ניתן לשלוח עד ${maxPages} עמודים בפקס.`
      )
    }

    return { pageCount }
  } finally {
    await document.loadingTask.destroy().catch((error: unknown) => {
      console.warn("Could not release PDF inspection resources:", error)
    })
  }
}
