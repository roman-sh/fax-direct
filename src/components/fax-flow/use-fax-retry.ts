"use client"

import { useState } from "react"

import type { FaxSessionData } from "@/shared/session/fax-session.types"

export type FaxRetryState =
  | { status: "idle" }
  | { status: "starting" }
  | { status: "error"; message: string }

type ErrorResponse = {
  message?: string
}

/** Starts a manual retry and returns its authoritative preparing session. */
export function useFaxRetry() {
  const [state, setState] =
    useState<FaxRetryState>({ status: "idle" })

  async function retry(): Promise<FaxSessionData | null> {
    setState({ status: "starting" })

    try {
      const response = await fetch("/api/session/fax/retry", {
        method: "POST",
      })
      const result = (await response.json()) as
        | ErrorResponse
        | FaxSessionData

      if (!response.ok) {
        throw new Error(
          "message" in result && result.message
            ? result.message
            : "לא הצלחנו להתחיל שליחה חוזרת. נסו שוב."
        )
      }

      setState({ status: "idle" })
      return result as FaxSessionData
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "לא הצלחנו להתחיל שליחה חוזרת. נסו שוב.",
      })
      return null
    }
  }

  return {
    retry,
    state,
  }
}
