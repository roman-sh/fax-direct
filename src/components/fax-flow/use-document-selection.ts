"use client"

import { useState } from "react"

import {
  ACCEPTED_DOCUMENT_FORMATS,
  getDocumentExtension,
} from "@/shared/document/document-formats"

export type DocumentSelectionState =
  | { status: "empty" }
  | { status: "valid" }
  | { status: "invalid"; message: string }

/** Owns the selected file and performs inexpensive browser-side checks. */
export function useDocumentSelection({
  maxFileBytes,
}: {
  maxFileBytes: number
}) {
  const [file, setFile] = useState<File | null>(null)
  const [selection, setSelection] =
    useState<DocumentSelectionState>({ status: "empty" })

  function selectFile(nextFile: File | null) {
    setFile(nextFile)

    if (!nextFile) {
      setSelection({ status: "empty" })
      return
    }

    const extension = getDocumentExtension(nextFile.name)
    const isAccepted = Object.keys(ACCEPTED_DOCUMENT_FORMATS).some(
      (format) => format === extension
    )

    if (!isAccepted) {
      setSelection({
        status: "invalid",
        message: "ניתן להעלות קובצי PDF, JPG או PNG בלבד.",
      })
      return
    }

    if (nextFile.size > maxFileBytes) {
      setSelection({
        status: "invalid",
        message: `גודל הקובץ המרבי הוא ${formatMegabytes(maxFileBytes)}MB.`,
      })
      return
    }

    if (nextFile.size === 0) {
      setSelection({
        status: "invalid",
        message: "הקובץ ריק.",
      })
      return
    }

    setSelection({ status: "valid" })
  }

  return {
    file,
    selection,
    selectFile,
  }
}

function formatMegabytes(bytes: number): string {
  return Number.isInteger(bytes / 1024 / 1024)
    ? String(bytes / 1024 / 1024)
    : (bytes / 1024 / 1024).toFixed(1)
}
