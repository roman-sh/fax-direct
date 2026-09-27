"use client"

import { useEffect, useRef, useState } from "react"

import {
  formatFaxPageProgressMessage,
  formatFaxSnapshotMessage,
  getFaxSnapshotFingerprint,
  type FaxMessageFormatters,
} from "@/components/fax-flow/fax-status-messages"
import { FAX_STATUS } from "@/shared/session/fax-session-status"
import type { FaxSessionFax } from "@/shared/session/fax-session.types"

const MAX_VISIBLE_ENTRIES = 8

export type FaxActivityEntry = {
  id: number
  message: string
}

let nextEntryId = 0

/**
 * Maintains the bounded, presentation-only activity history for the delivery
 * status card. The poller rebroadcasts identical snapshots every ten seconds;
 * a repeated fingerprint refreshes nothing visible, so no duplicate lines
 * appear. The feed is never persisted — after a refresh it reseeds from the
 * current authoritative snapshot only.
 *
 * Page progress and status transitions are recorded independently. A provider
 * snapshot can therefore append two lines when it both advances the page count
 * and settles the fax, preserving the final page before success or failure.
 */
export function useFaxActivityLog(
  fax: FaxSessionFax | null,
  formatters: FaxMessageFormatters
): FaxActivityEntry[] {
  const [entries, setEntries] = useState<FaxActivityEntry[]>([])
  const lastFingerprintRef = useRef<string | null>(null)
  const previousFaxRef = useRef<FaxSessionFax | null>(null)

  useEffect(() => {
    const fingerprint = getFaxSnapshotFingerprint(fax)

    if (lastFingerprintRef.current === fingerprint) {
      return
    }

    const previousFax = previousFaxRef.current

    lastFingerprintRef.current = fingerprint
    previousFaxRef.current = fax

    if (fax?.status === FAX_STATUS.FAILED && fax.error === null) {
      console.error("Invalid fax snapshot: status is 'failed' but error is null.")
    }

    const messages: string[] = []
    const previousPagesSent = previousFax?.pagesSent ?? 0
    const pagesAdvanced = fax !== null && fax.pagesSent > previousPagesSent

    // Page progress and delivery state are independent facts. InterFAX may
    // report the final page in the same snapshot that confirms delivery, so
    // record the page first instead of letting the terminal status hide it.
    if (pagesAdvanced) {
      messages.push(
        formatFaxPageProgressMessage(
          fax.pagesSent,
          fax.pagesSubmitted,
          formatters
        )
      )
    }

    const statusChanged = fax?.status !== previousFax?.status

    if (!fax) {
      messages.push(formatFaxSnapshotMessage(fax, formatters))
    } else if (
      statusChanged &&
      // A progress line already communicates that transmission is underway;
      // do not duplicate it when the first sending snapshot includes a page.
      !(fax.status === FAX_STATUS.SENDING && pagesAdvanced)
    ) {
      messages.push(formatFaxSnapshotMessage(fax, formatters))
    }

    if (!messages.length) {
      return
    }

    const newEntries = messages.map((message) => ({
      id: nextEntryId++,
      message,
    }))

    setEntries((previous) =>
      [...previous, ...newEntries].slice(-MAX_VISIBLE_ENTRIES)
    )
  }, [fax, formatters])

  return entries
}
