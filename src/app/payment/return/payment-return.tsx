"use client"

import { useEffect } from "react"

import { Spinner } from "@/components/ui/spinner"

/**
 * Keeps PayMe's browser return useful in both checkout contexts.
 *
 * A desktop checkout returns inside its iframe, where the existing session
 * WebSocket will remove this view as soon as the server callback confirms the
 * payment. Bit may instead open the return URL as a top-level mobile tab; that
 * tab goes back to the homepage and resumes the same cookie-backed session.
 */
export function PaymentReturn() {
  useEffect(() => {
    if (window.self === window.top) {
      window.location.replace("/")
    }
  }, [])

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6">
      <div className="flex flex-col items-center gap-3 text-center text-muted-foreground">
        <Spinner className="size-7 text-brand" />
        <p>מאשרים את התשלום…</p>
      </div>
    </main>
  )
}
