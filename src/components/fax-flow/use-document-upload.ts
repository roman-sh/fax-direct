"use client"

import { useRef, useState } from "react"

export type DocumentUploadState =
  | { status: "idle" }
  | { status: "uploading" }
  | { status: "ready" }
  | { status: "error"; message: string }

type ErrorResponse = {
  message?: string
}

/** Uploads the client-validated PDF and tracks its authoritative server state. */
export function useDocumentUpload() {
  const [state, setState] =
    useState<DocumentUploadState>({ status: "idle" })
  const uploadedFile = useRef<File | null>(null)

  async function upload(file: File): Promise<boolean> {
    if (uploadedFile.current === file && state.status === "ready") {
      return true
    }

    setState({ status: "uploading" })

    try {
      const formData = new FormData()
      formData.set("file", file)

      const response = await fetch("/api/session/document", {
        method: "POST",
        body: formData,
      })
      const result = (await response.json()) as ErrorResponse

      if (!response.ok) {
        throw new Error(
          result.message ?? "לא הצלחנו להעלות את המסמך. נסו שוב."
        )
      }

      uploadedFile.current = file
      setState({ status: "ready" })
      return true
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "לא הצלחנו להעלות את המסמך. נסו שוב.",
      })
      return false
    }
  }

  function reset() {
    uploadedFile.current = null
    setState({ status: "idle" })
  }

  return {
    reset,
    state,
    upload,
  }
}
