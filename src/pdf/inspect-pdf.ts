import { PDFDocument } from "pdf-lib"

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
  let document: PDFDocument

  try {
    document = await PDFDocument.load(bytes, {
      ignoreEncryption: true,
      updateMetadata: false,
    })
  } catch {
    throw new PdfInspectionError(
      "INVALID_PDF",
      "לא הצלחנו לקרוא את קובץ ה-PDF."
    )
  }

  if (document.isEncrypted) {
    throw new PdfInspectionError(
      "ENCRYPTED_PDF",
      "לא ניתן לשלוח קובץ PDF מוגן בסיסמה."
    )
  }

  const pageCount = document.getPageCount()

  if (pageCount === 0) {
    throw new PdfInspectionError("EMPTY_PDF", "קובץ ה-PDF אינו מכיל עמודים.")
  }

  if (pageCount > maxPages) {
    throw new PdfInspectionError(
      "TOO_MANY_PAGES",
      `ניתן לשלוח עד ${maxPages} עמודים בפקס.`
    )
  }

  return { pageCount }
}
