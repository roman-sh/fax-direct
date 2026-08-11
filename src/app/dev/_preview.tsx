"use client"

import { useEffect, useState, type ReactNode } from "react"

import { FLOW_STACK_CLASS } from "@/components/fax-flow/flow-card"

/**
 * Shared furniture for the preview pages. A preview frame keeps every example
 * at the same width as the real sheet so proportions are honest, and labels it
 * with the state it represents.
 */
export function PreviewPage({
  title,
  intro,
  children,
}: {
  title: string
  intro: string
  children: ReactNode
}) {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-2">
        <span className="font-mono text-xs tracking-widest text-brand uppercase">
          preview
        </span>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{intro}</p>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Resize the window to check the breakpoint. These are the production
          components, so any fix made while looking at them is a real fix.
        </p>
      </header>
      {children}
    </main>
  )
}

/** One labelled example, rendered at the same height as the real sheet. */
export function PreviewCase({
  label,
  note,
  children,
}: {
  label: string
  note?: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-3 border-b border-border pb-2">
        <h2 className="font-mono text-sm font-semibold">{label}</h2>
        {note ? (
          <p className="text-sm text-muted-foreground">{note}</p>
        ) : null}
      </div>
      <div className={FLOW_STACK_CLASS}>
        {children}
      </div>
    </section>
  )
}

/**
 * Stands in for the snapshots the session WebSocket delivers, so the heartbeat
 * can be judged without paying for a fax and watching it go out.
 *
 * The default matches what the provider poll actually produces — a broadcast
 * roughly every eleven seconds for as long as a delivery is running, whether
 * or not anything in it changed. Nothing here is imported by the application;
 * in the real flow the count comes from the socket, which is the entire point
 * of the signal.
 */
export function useLocalBeat(intervalMs = 11_000) {
  const [beat, setBeat] = useState(1)

  useEffect(() => {
    const timer = setInterval(
      () => setBeat((count) => count + 1),
      intervalMs
    )

    return () => clearInterval(timer)
  }, [intervalMs])

  return beat
}

/**
 * Holds the active step locally so a preview behaves like the real sheet when
 * a collapsed card is clicked, without any session behind it.
 */
export function useLocalStep(initial: 1 | 2 | 3) {
  return useState<1 | 2 | 3>(initial)
}
