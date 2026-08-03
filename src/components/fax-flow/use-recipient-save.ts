"use client"

import { useState } from "react"

import type { FaxSessionData } from "@/shared/session/fax-session.types"

export type RecipientSaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "ready" }
  | { status: "error"; message: string }

type ErrorResponse = {
  message?: string
}

/** Saves the recipient and returns the authoritative payment-ready session. */
export function useRecipientSave() {
  const [state, setState] =
    useState<RecipientSaveState>({ status: "idle" })

  async function save(
    recipient: string
  ): Promise<FaxSessionData | null> {
    setState({ status: "saving" })

    try {
      const response = await fetch("/api/session/recipient", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recipient }),
      })
      const result = (await response.json()) as
        | ErrorResponse
        | FaxSessionData

      if (!response.ok) {
        throw new Error(
          "message" in result && result.message
            ? result.message
            : "לא הצלחנו לשמור את מספר הפקס. נסו שוב."
        )
      }

      setState({ status: "ready" })
      return result as FaxSessionData
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "לא הצלחנו לשמור את מספר הפקס. נסו שוב.",
      })
      return null
    }
  }

  function reset() {
    setState({ status: "idle" })
  }

  return {
    reset,
    save,
    state,
  }
}
