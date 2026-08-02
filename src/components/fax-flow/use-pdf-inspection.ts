"use client"

import { useRef, useState } from "react"

export type PdfInspectionState =
  | { status: "empty" }
  | { status: "inspecting" }
  | { status: "valid"; pageCount: number }
  | { status: "invalid"; message: string }

/**
 * Owns the selected PDF and its client-side inspection lifecycle. Sequence
 * numbers prevent a slower inspection from replacing the result of a file the
 * user selected more recently.
 */
export function usePdfInspection({
  maxFileBytes,
  maxPages,
}: {
  maxFileBytes: number
  maxPages: number
}) {
  const [file, setFile] = useState<File | null>(null)
  const [inspection, setInspection] =
    useState<PdfInspectionState>({ status: "empty" })
  const inspectionSequence = useRef(0)

  function selectFile(nextFile: File | null) {
    const sequence = ++inspectionSequence.current

    setFile(nextFile)

    if (!nextFile) {
      setInspection({ status: "empty" })
      return
    }

    setInspection({ status: "inspecting" })
    void inspectSelectedFile(nextFile, sequence)
  }

  async function inspectSelectedFile(selectedFile: File, sequence: number) {
    try {
      const { inspectPdfFile } = await import("@/shared/pdf/inspect-pdf")
      const result = await inspectPdfFile(selectedFile, {
        maxFileBytes,
        maxPages,
      })

      if (inspectionSequence.current === sequence) {
        setInspection({
          status: "valid",
          pageCount: result.pageCount,
        })
      }
    } catch (error) {
      if (inspectionSequence.current !== sequence) {
        return
      }

      setInspection({
        status: "invalid",
        message:
          error instanceof Error && error.name === "PdfInspectionError"
            ? error.message
            : "לא הצלחנו לבדוק את הקובץ. נסו שוב.",
      })
    }
  }

  return {
    file,
    inspection,
    selectFile,
  }
}
