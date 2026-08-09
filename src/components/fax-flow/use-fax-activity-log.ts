"use client"

import { useEffect, useRef, useState } from "react"

import {
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
 * Failed snapshots are deliberately not appended: the status step renders the
 * single primary failure message itself, and a second copy in this feed would
 * both violate the one-message rule and announce twice via aria-live.
 */
export function useFaxActivityLog(
  fax: FaxSessionFax | null,
  formatters: FaxMessageFormatters
): FaxActivityEntry[] {
  const [entries, setEntries] = useState<FaxActivityEntry[]>([])
  const lastFingerprintRef = useRef<string | null>(null)

  useEffect(() => {
    const fingerprint = getFaxSnapshotFingerprint(fax)

    if (lastFingerprintRef.current === fingerprint) {
      return
    }

    lastFingerprintRef.current = fingerprint

    if (fax?.status === FAX_STATUS.FAILED) {
      if (fax.error === null) {
        console.error(
          "Invalid fax snapshot: status is 'failed' but error is null."
        )
      }

      return
    }

    const entry: FaxActivityEntry = {
      id: nextEntryId++,
      message: formatFaxSnapshotMessage(fax, formatters),
    }

    setEntries((previous) =>
      [...previous, entry].slice(-MAX_VISIBLE_ENTRIES)
    )
  }, [fax, formatters])

  return entries
}
