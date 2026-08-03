"use client"

import { useCallback, useEffect, useState } from "react"
import ReconnectingWebSocket from "partysocket/ws"

import type { FaxSessionEvent } from "@/shared/session/fax-session-event"
import type { FaxSessionData } from "@/shared/session/fax-session.types"

export type FaxSessionLoadState =
  | { status: "loading" }
  | { status: "ready"; session: FaxSessionData }
  | { status: "error"; message: string }

type ErrorResponse = {
  message?: string
}

/** Restores the server-owned fax session associated with the signed cookie. */
export function useFaxSession() {
  const [state, setState] =
    useState<FaxSessionLoadState>({ status: "loading" })
  const shouldConnect =
    state.status === "ready" && state.session.document !== null

  const load = useCallback(async (signal?: AbortSignal) => {
    setState({ status: "loading" })

    try {
      const response = await fetch("/api/session", {
        method: "POST",
        signal,
      })
      const result = (await response.json()) as
        | ErrorResponse
        | FaxSessionData

      if (!response.ok) {
        throw new Error(
          "message" in result && result.message
            ? result.message
            : "לא הצלחנו לשחזר את השליחה. נסו שוב."
        )
      }

      setState({
        status: "ready",
        session: result as FaxSessionData,
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return
      }

      setState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "לא הצלחנו לשחזר את השליחה. נסו שוב.",
      })
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)

    return () => controller.abort()
  }, [load])

  useEffect(() => {
    if (!shouldConnect) {
      return
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const webSocket = new ReconnectingWebSocket(
      `${protocol}//${window.location.host}/api/session/events`
    )

    webSocket.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(String(event.data)) as FaxSessionEvent

        if (message.type === "session") {
          setState({ status: "ready", session: message.session })
        }
      } catch {
        // Ignore malformed messages and keep the last authoritative snapshot.
      }
    })

    return () => {
      webSocket.close(1000, "Session view closed")
    }
  }, [shouldConnect])

  const update = useCallback((session: FaxSessionData) => {
    setState({ status: "ready", session })
  }, [])

  return {
    load,
    state,
    update,
  }
}
