"use client"

import { useEffect } from "react"

/**
 * Ensures the browser receives or restores its HttpOnly fax-session cookie.
 * The endpoint is safe to call again when Strict Mode re-runs this Effect in
 * development.
 */
export function useFaxSession() {
  useEffect(() => {
    void fetch("/api/session", {
      method: "POST",
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Session initialization failed: ${response.status}`)
        }
      })
      .catch((error: unknown) => {
        console.error("Could not initialize fax session:", error)
      })
  }, [])
}
