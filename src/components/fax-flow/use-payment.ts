"use client"

import { useState } from "react"

import type { FaxSessionData } from "@/shared/session/fax-session.types"

export type PaymentStartState =
  | { status: "idle" }
  | { status: "starting" }
  | { status: "ready" }
  | { status: "error"; message: string }

type ErrorResponse = {
  message?: string
}

/** Starts server-owned payment and returns its authoritative pending session. */
export function usePayment() {
  const [state, setState] =
    useState<PaymentStartState>({ status: "idle" })

  async function start(): Promise<FaxSessionData | null> {
    setState({ status: "starting" })

    try {
      const response = await fetch("/api/session/payment", {
        method: "POST",
      })
      const result = (await response.json()) as
        | ErrorResponse
        | FaxSessionData

      if (!response.ok) {
        throw new Error(
          "message" in result && result.message
            ? result.message
            : "לא הצלחנו לפתוח את התשלום. נסו שוב."
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
            : "לא הצלחנו לפתוח את התשלום. נסו שוב.",
      })
      return null
    }
  }

  return {
    start,
    state,
  }
}
