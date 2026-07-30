import { getDocumentProxy } from "unpdf"
import {
  PasswordException,
  PasswordResponses,
  type PDFDocumentProxy,
} from "unpdf/pdfjs"

const ACCEPTED_PDF_TYPES = new Set([
  "application/pdf",
  "application/x-pdf",
])

export type PdfInspectionErrorCode =
  | "ENCRYPTED_PDF"
  | "EMPTY_PDF"
  | "FILE_TOO_LARGE"
  | "INVALID_FILE_TYPE"
  | "INVALID_PDF"
  | "TOO_MANY_PAGES"

export type PdfInspectionLimits = {
  maxFileBytes: number
  maxPages: number
}

export class PdfInspectionError extends Error {
  constructor(
    readonly code: PdfInspectionErrorCode,
    message: string
  ) {
    super(message)
    this.name = "PdfInspectionError"
  }
}

export async function inspectPdfFile(
  file: File,
  limits: PdfInspectionLimits
): Promise<{ pageCount: number }> {
  if (file.type && !ACCEPTED_PDF_TYPES.has(file.type)) {
    throw new PdfInspectionError(
      "INVALID_FILE_TYPE",
      "ניתן להעלות קובצי PDF בלבד."
    )
  }

  if (file.size > limits.maxFileBytes) {
    throw new PdfInspectionError(
      "FILE_TOO_LARGE",
      `גודל הקובץ המרבי הוא ${formatMegabytes(limits.maxFileBytes)}MB.`
    )
  }

  if (file.size === 0) {
    throw new PdfInspectionError("EMPTY_PDF", "קובץ ה-PDF ריק.")
  }

  return inspectPdf(
    new Uint8Array(await file.arrayBuffer()),
    limits.maxPages
  )
}

async function inspectPdf(
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

function formatMegabytes(bytes: number): string {
  return Number.isInteger(bytes / 1024 / 1024)
    ? String(bytes / 1024 / 1024)
    : (bytes / 1024 / 1024).toFixed(1)
}
