"use client"

import { useCallback, useState } from "react"

export type PaymentStartState =
  | { status: "idle" }
  | { status: "starting" }
  | { status: "error"; message: string }

type ErrorResponse = {
  message?: string
}

/** Starts server-owned payment while WebSocket snapshots carry its result. */
export function usePayment() {
  const [state, setState] =
    useState<PaymentStartState>({ status: "idle" })

  async function start(): Promise<void> {
    setState({ status: "starting" })

    try {
      const response = await fetch("/api/session/payment", {
        method: "POST",
      })

      if (!response.ok) {
        const result = (await response.json()) as ErrorResponse

        throw new Error(
          result.message
            ? result.message
            : "לא הצלחנו לפתוח את התשלום. נסו שוב."
        )
      }
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "לא הצלחנו לפתוח את התשלום. נסו שוב.",
      })
    }
  }

  const reset = useCallback(() => {
    setState({ status: "idle" })
  }, [])

  return {
    reset,
    start,
    state,
  }
}
