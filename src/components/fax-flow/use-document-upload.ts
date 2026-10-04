"use client"

import { useState } from "react"

import type { FaxSessionData } from "@/shared/session/fax-session.types"

export type DocumentUploadState =
  | { status: "idle" }
  | { status: "uploading" }
  | { status: "error"; message: string }

type ErrorResponse = {
  message?: string
}

/** Tracks the HTTP upload itself; document processing lives in the session. */
export function useDocumentUpload() {
  const [state, setState] =
    useState<DocumentUploadState>({ status: "idle" })

  async function upload(file: File): Promise<FaxSessionData | null> {
    setState({ status: "uploading" })

    try {
      const formData = new FormData()
      formData.set("file", file)

      const response = await fetch("/api/session/document", {
        method: "POST",
        body: formData,
      })
      const result = (await response.json()) as
        | ErrorResponse
        | FaxSessionData

      if (!response.ok) {
        throw new Error(
          "message" in result && result.message
            ? result.message
            : "לא הצלחנו להעלות את המסמך. נסו שוב."
        )
      }

      const session = result as FaxSessionData
      setState({ status: "idle" })
      return session
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "לא הצלחנו להעלות את המסמך. נסו שוב.",
      })
      return null
    }
  }

  function reset() {
    setState({ status: "idle" })
  }

  return {
    reset,
    state,
    upload,
  }
}
