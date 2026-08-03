"use client"

import { useRef, useState } from "react"

import type { FaxSessionData } from "@/shared/session/fax-session.types"

export type DocumentUploadState =
  | { status: "idle" }
  | { status: "uploading" }
  | { status: "ready" }
  | { status: "error"; message: string }

type ErrorResponse = {
  message?: string
}

/** Uploads the client-validated PDF and returns authoritative session state. */
export function useDocumentUpload() {
  const [state, setState] =
    useState<DocumentUploadState>({ status: "idle" })
  const uploadedFile = useRef<File | null>(null)
  const uploadedSession = useRef<FaxSessionData | null>(null)

  async function upload(file: File): Promise<FaxSessionData | null> {
    if (uploadedFile.current === file && state.status === "ready") {
      return uploadedSession.current
    }

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
      uploadedFile.current = file
      uploadedSession.current = session
      setState({ status: "ready" })
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
    uploadedFile.current = null
    uploadedSession.current = null
    setState({ status: "idle" })
  }

  return {
    reset,
    state,
    upload,
  }
}
