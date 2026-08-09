"use client"

import { useEffect, useMemo, useRef } from "react"
import { CheckCircle2, CircleAlert, Clock } from "lucide-react"

import {
  createFaxMessageFormatters,
  formatFaxSnapshotMessage,
  type FaxUiLocale,
} from "@/components/fax-flow/fax-status-messages"
import { CardHeading } from "@/components/fax-flow/flow-card"
import {
  useFaxActivityLog,
  type FaxActivityEntry,
} from "@/components/fax-flow/use-fax-activity-log"
import { CardContent } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { FAX_STATUS } from "@/shared/session/fax-session-status"
import type { FaxSessionFax } from "@/shared/session/fax-session.types"

type FaxDeliveryStatusStepProps = {
  fax: FaxSessionFax | null
  fileSummary: string
  recipientSummary: string
  pageCount: number | null
  locale: FaxUiLocale
}

type DeliveryTone = "active" | "delayed" | "success" | "failure"

type DeliveryPresentation = {
  tone: DeliveryTone
  title: string
  description: string
}

/**
 * Replaces the payment summary inside the third card once the authoritative
 * session confirms payment. Renders exclusively from `session.fax` snapshots;
 * the activity feed below is presentation history and never drives state.
 */
export function FaxDeliveryStatusStep({
  fax,
  fileSummary,
  recipientSummary,
  pageCount,
  locale,
}: FaxDeliveryStatusStepProps) {
  const formatters = useMemo(
    () => createFaxMessageFormatters(locale),
    [locale]
  )
  const entries = useFaxActivityLog(fax, formatters)
  const presentation = getDeliveryPresentation(fax)
  const isFailed = fax?.status === FAX_STATUS.FAILED

  return (
    <>
      <CardHeading
        step={3}
        title="סטטוס השליחה"
        description={presentation.description}
      />
      <CardContent className="flex min-h-0 flex-1 flex-col p-7">
        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-5">
          <div className="flex items-center gap-3">
            <DeliveryStateIcon tone={presentation.tone} />
            <h3
              className={cn(
                "text-lg font-semibold",
                TONE_TEXT_CLASS[presentation.tone]
              )}
            >
              {presentation.title}
            </h3>
          </div>

          {/* The single primary failure message. The activity log suppresses
              failed snapshots, so this is the only copy on screen and the
              only live region announcing it. */}
          {isFailed ? (
            <p role="status" className="text-sm text-destructive">
              {formatFaxSnapshotMessage(fax, formatters)}
            </p>
          ) : null}

          <dl className="flex flex-col gap-3">
            <SummaryRow label="מסמך" value={fileSummary} ltr />
            <SummaryRow label="מספר פקס" value={recipientSummary} ltr />
            <FaxPageProgress
              fax={fax}
              pageCount={pageCount}
              tone={presentation.tone}
            />
          </dl>
        </div>

        <FaxActivityLog entries={entries} />
      </CardContent>
    </>
  )
}

const TONE_TEXT_CLASS: Record<DeliveryTone, string> = {
  active: "text-brand",
  delayed: "text-warning",
  success: "text-success",
  failure: "text-destructive",
}

function getDeliveryPresentation(
  fax: FaxSessionFax | null
): DeliveryPresentation {
  const activeDescription = "אנחנו מעדכנים כאן את מצב השליחה בזמן אמת."

  if (!fax) {
    return {
      tone: "active",
      title: "מתחילים את השליחה",
      description: activeDescription,
    }
  }

  switch (fax.status) {
    case FAX_STATUS.PREPARING:
      return {
        tone: "active",
        title: "מכינים את המסמך",
        description: activeDescription,
      }
    case FAX_STATUS.QUEUED:
      return {
        tone: "active",
        title: "ממתין בתור לשליחה",
        description: activeDescription,
      }
    case FAX_STATUS.SENDING:
      return {
        tone: "active",
        title: "שולחים את הפקס",
        description: activeDescription,
      }
    case FAX_STATUS.FINALIZING:
      return {
        tone: "active",
        title: "ממתינים לאישור המסירה",
        description: activeDescription,
      }
    case FAX_STATUS.SERVICE_DELAYED:
      return {
        tone: "delayed",
        title: "השליחה מתעכבת",
        description: activeDescription,
      }
    case FAX_STATUS.DELIVERED:
      return {
        tone: "success",
        title: "הפקס נמסר בהצלחה",
        description: "השליחה הושלמה ואושרה.",
      }
    case FAX_STATUS.FAILED:
      return {
        tone: "failure",
        title: "השליחה נכשלה",
        description: "השליחה לא הושלמה.",
      }
  }
}

function DeliveryStateIcon({ tone }: { tone: DeliveryTone }) {
  if (tone === "success") {
    return <CheckCircle2 className="size-6 shrink-0 text-success" />
  }

  if (tone === "failure") {
    return <CircleAlert className="size-6 shrink-0 text-destructive" />
  }

  if (tone === "delayed") {
    return <Clock className="size-6 shrink-0 text-warning" />
  }

  return <Spinner className="size-6 shrink-0 text-brand" />
}

const TONE_BAR_CLASS: Record<DeliveryTone, string> = {
  active: "bg-brand",
  delayed: "bg-warning",
  success: "bg-success",
  failure: "bg-destructive",
}

function FaxPageProgress({
  fax,
  pageCount,
  tone,
}: {
  fax: FaxSessionFax | null
  pageCount: number | null
  tone: DeliveryTone
}) {
  const pagesSent = fax?.pagesSent ?? 0
  // Before the provider reports totals, fall back to the stored page count so
  // the counter never shows "0 / 0" for a known document.
  const pagesTotal =
    fax && fax.pagesSubmitted > 0 ? fax.pagesSubmitted : (pageCount ?? 0)
  // Full pages never imply delivery; only the delivered status fills the bar
  // with the success color, keeping "2/2 finalizing" distinct from delivered.
  const percent =
    fax?.status === FAX_STATUS.DELIVERED
      ? 100
      : pagesTotal > 0
        ? Math.min((pagesSent / pagesTotal) * 100, 100)
        : 0

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-w-0 items-baseline gap-3 text-sm">
        <dt className="shrink-0 text-muted-foreground">עמודים</dt>
        <span
          aria-hidden="true"
          className="flex-1 border-b border-dotted border-border"
        />
        <dd dir="ltr" className="font-medium tabular-nums">
          {pagesSent} / {pagesTotal > 0 ? pagesTotal : "—"}
        </dd>
      </div>
      <div
        role="progressbar"
        aria-label="התקדמות שליחת העמודים"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500 ease-out",
            TONE_BAR_CLASS[tone],
            // A full bar during finalizing keeps breathing so the wait for
            // provider confirmation does not look like a stall.
            fax?.status === FAX_STATUS.FINALIZING && "animate-pulse"
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

function FaxActivityLog({ entries }: { entries: FaxActivityEntry[] }) {
  const scrollRef = useRef<HTMLOListElement>(null)
  const isPinnedToLatestRef = useRef(true)
  const isEmpty = entries.length === 0

  // Follow the newest entry unless the user scrolled up to read history.
  useEffect(() => {
    const list = scrollRef.current

    if (list && isPinnedToLatestRef.current) {
      list.scrollTop = list.scrollHeight
    }
  }, [entries])

  function handleScroll() {
    const list = scrollRef.current

    if (list) {
      isPinnedToLatestRef.current =
        list.scrollHeight - list.scrollTop - list.clientHeight < 8
    }
  }

  // A failed fax restored after refresh has no non-failure history to show;
  // an empty console box would only draw attention to nothing.
  if (isEmpty) {
    return null
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-2">
      <h4 className="text-xs font-medium text-muted-foreground">פעילות</h4>
      <ol
        ref={scrollRef}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        className="h-24 overflow-y-auto rounded-md border border-border bg-muted/40 px-3 py-2"
      >
        {entries.map((entry, index) => {
          const stepsFromNewest = entries.length - 1 - index
          const isNewest = stepsFromNewest === 0

          return (
            <li
              key={entry.id}
              style={{ opacity: Math.max(1 - stepsFromNewest * 0.16, 0.4) }}
              className={cn(
                "flex items-baseline gap-2 py-0.5 text-sm",
                isNewest
                  ? "font-medium text-foreground"
                  : "text-muted-foreground"
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "shrink-0 select-none",
                  isNewest ? "text-brand" : "invisible"
                )}
              >
                ‹
              </span>
              <span className="min-w-0">{entry.message}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function SummaryRow({
  label,
  value,
  ltr = false,
}: {
  label: string
  value: string
  ltr?: boolean
}) {
  return (
    <div className="flex min-w-0 items-baseline gap-3 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <span
        aria-hidden="true"
        className="flex-1 border-b border-dotted border-border"
      />
      <dd
        dir={ltr ? "ltr" : undefined}
        title={value}
        className="max-w-72 truncate font-medium"
      >
        {value}
      </dd>
    </div>
  )
}
