"use client"

import { useState } from "react"

export type RecipientSaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "ready" }
  | { status: "error"; message: string }

type ErrorResponse = {
  message?: string
}

/** Saves the recipient and quote before the flow enters the payment card. */
export function useRecipientSave() {
  const [state, setState] =
    useState<RecipientSaveState>({ status: "idle" })

  async function save(recipient: string): Promise<boolean> {
    setState({ status: "saving" })

    try {
      const response = await fetch("/api/session/recipient", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recipient }),
      })

      if (!response.ok) {
        const result = (await response.json()) as ErrorResponse

        throw new Error(
          result.message ?? "לא הצלחנו לשמור את מספר הפקס. נסו שוב."
        )
      }

      setState({ status: "ready" })
      return true
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "לא הצלחנו לשמור את מספר הפקס. נסו שוב.",
      })
      return false
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
