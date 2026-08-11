"use client"

import { useEffect, useMemo, useRef, type ReactNode } from "react"
import {
  CheckCircle2,
  CircleAlert,
  Clock,
  FileText,
  Phone,
  RotateCcw,
} from "lucide-react"

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
import type { FaxRetryState } from "@/components/fax-flow/use-fax-retry"
import { Button } from "@/components/ui/button"
import { CardContent } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { FAX_STATUS } from "@/shared/session/fax-session-status"
import type {
  FaxFailureSemanticCode,
  FaxSessionFax,
} from "@/shared/session/fax-session.types"

type FaxDeliveryStatusStepProps = {
  fax: FaxSessionFax | null
  fileSummary: string
  recipientSummary: string
  pageCount: number | null
  locale: FaxUiLocale
  retryState: FaxRetryState
  onRetry: () => void
  onEditNumber: () => void
  onEditDocument: () => void
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
  retryState,
  onRetry,
  onEditNumber,
  onEditDocument,
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
      {/* The heading's description slot carries the failure sentence, so it is
          the single primary message and the only live region announcing it —
          the activity log suppresses failed snapshots. Actions sit beside it
          rather than below the content, leaving the body's height untouched in
          every state. */}
      <CardHeading
        title="סטטוס השליחה"
        description={
          isFailed
            ? formatFaxSnapshotMessage(fax, formatters)
            : presentation.description
        }
        descriptionTone={isFailed ? "destructive" : "muted"}
        actions={
          isFailed ? (
            <FaxFailureActions
              errorCode={fax.error}
              retryState={retryState}
              onRetry={onRetry}
              onEditNumber={onEditNumber}
              onEditDocument={onEditDocument}
            />
          ) : null
        }
      />
      <CardContent className="flex min-h-0 flex-1 flex-col p-7">
        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-5">
          <div className="flex items-center gap-3" role="status">
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

          <dl className="flex flex-col gap-3">
            <SummaryRow label="מסמך" value={fileSummary} ltr />
            <SummaryRow label="מספר פקס" value={recipientSummary} ltr />
            {/* Page counts are hidden when nothing was transmitted: "0 / 2"
                beside a failure adds no information. They stay for a partial
                transmission, where how much arrived is the whole point. */}
            {!isFailed || (fax?.pagesSent ?? 0) > 0 ? (
              <FaxPageProgress
                fax={fax}
                pageCount={pageCount}
                tone={presentation.tone}
              />
            ) : null}
          </dl>
        </div>

        <FaxActivityLog entries={entries} />
      </CardContent>
    </>
  )
}

type FaxFailureAction = "retry" | "editNumber" | "editDocument"

type FailureGuidance = {
  /**
   * The action worth emphasizing, or null when none is. Retry is always
   * offered; a null primary leaves every button quiet, which is how a failure
   * says "we cannot recommend anything here" rather than steering.
   */
  primary: FaxFailureAction | null
  /** The one edit worth offering, if the failure points at one. */
  edit: Exclude<FaxFailureAction, "retry"> | null
}

/**
 * What each failure suggests the customer should do.
 *
 * `edit` follows a rule rather than a judgement: the document when the PDF
 * itself failed to convert, the fax number in every other case. The provider
 * cannot reliably distinguish a wrong number from a bad route — an auto-answer
 * voice line returns the same generic telephony error as a carrier fault — so
 * withholding the edit means guessing on the customer's behalf and sometimes
 * stranding them. On mobile the collapsed cards are not tappable, which makes
 * this button the only way back to the number.
 *
 * `primary` carries what confidence we do have. It only sets emphasis; both
 * routes are always present.
 */
const FAILURE_GUIDANCE: Record<FaxFailureSemanticCode, FailureGuidance> = {
  // A machine answered and is occupied, so the number reached something.
  BUSY: { primary: "retry", edit: "editNumber" },

  // Nothing answered. The machine may be off, or the number may be wrong;
  // retrying is the cheaper of the two to try first.
  NO_ANSWER: { primary: "retry", edit: "editNumber" },

  // A person answered, so this is not a fax line. Retrying calls them again.
  VOICE_ANSWERED: { primary: "editNumber", edit: "editNumber" },

  // The provider could not parse or route the number. Retrying cannot help.
  INVALID_NUMBER: { primary: "editNumber", edit: "editNumber" },

  // The number cannot be dialled, commonly because it is disconnected.
  DESTINATION_UNAVAILABLE: { primary: "editNumber", edit: "editNumber" },

  // The destination refused the call. A refusal is a decision, not a glitch,
  // so repeating it is the less promising of the two.
  CALL_REJECTED: { primary: "editNumber", edit: "editNumber" },

  // No carrier route right now. InterFAX reroutes later attempts through
  // different lines, so a retry genuinely differs from this one.
  ROUTE_UNAVAILABLE: { primary: "retry", edit: "editNumber" },

  // Something answered but the two could not negotiate a fax session.
  FAX_INCOMPATIBLE: { primary: "retry", edit: "editNumber" },

  // The connection dropped mid-transmission, so the call had been established.
  TRANSMISSION_INTERRUPTED: { primary: "retry", edit: "editNumber" },

  // A generic telephony error. InterFAX documents the whole 99xx range as call
  // setup failures that do not necessarily prevent a later transmission,
  // because it reroutes on subsequent attempts.
  CONNECTION_FAILED: { primary: "retry", edit: "editNumber" },

  // The PDF could not be prepared, so the same file fails the same way. Retry
  // stays available for a transient conversion fault only.
  DOCUMENT_PROCESSING_FAILED: {
    primary: "editDocument",
    edit: "editDocument",
  },

  // Deliberately stopped; nothing is wrong with the number or the document.
  CANCELED: { primary: "retry", edit: "editNumber" },

  // A provider-side outage. Time is the only fix.
  SERVICE_UNAVAILABLE: { primary: "retry", edit: "editNumber" },

  // Unclassified, so both explanations stay open.
  UNKNOWN_FAILURE: { primary: "retry", edit: "editNumber" },

  // Every page was transmitted but never confirmed, so the recipient may
  // already hold the document. Nothing is emphasized: the message asks them to
  // check first, because retrying may simply send it twice.
  DELIVERY_UNCONFIRMED: { primary: null, edit: "editNumber" },

  // Part of the document arrived. Retrying resends all of it.
  PARTIAL_TRANSMISSION: { primary: null, edit: "editNumber" },
}

/** Falls back to the unknown-failure row for a snapshot missing its code. */
function getFailureGuidance(
  errorCode: FaxFailureSemanticCode | null
): FailureGuidance {
  return FAILURE_GUIDANCE[errorCode ?? "UNKNOWN_FAILURE"]
}

/**
 * Contextual actions for a final failure. All three recovery paths stay
 * available; the semantic failure code only decides which one is presented
 * as the primary suggestion.
 */
function FaxFailureActions({
  errorCode,
  retryState,
  onRetry,
  onEditNumber,
  onEditDocument,
}: {
  errorCode: FaxFailureSemanticCode | null
  retryState: FaxRetryState
  onRetry: () => void
  onEditNumber: () => void
  onEditDocument: () => void
}) {
  const { primary, edit } = getFailureGuidance(errorCode)
  const isRetrying = retryState.status === "starting"

  // At most two buttons: retry is always offered, joined by the one edit the
  // failure points at. Offering both edits would ask the customer to diagnose
  // their own failure, and the document and recipient cards stay reachable for
  // anything the message did not anticipate.
  const editAction: {
    action: FaxFailureAction
    label: string
    icon: ReactNode
    onClick: () => void
  } | null =
    edit === "editDocument"
      ? {
          action: "editDocument",
          label: "החלפת המסמך",
          icon: <FileText data-icon="inline-start" />,
          onClick: onEditDocument,
        }
      : edit === "editNumber"
        ? {
            action: "editNumber",
            label: "עריכת מספר הפקס",
            icon: <Phone data-icon="inline-start" />,
            onClick: onEditNumber,
          }
        : null

  const retryAction = {
    action: "retry" as const,
    label: "שליחה מחדש",
    icon: isRetrying ? (
      <Spinner data-icon="inline-start" />
    ) : (
      <RotateCcw data-icon="inline-start" />
    ),
    onClick: onRetry,
  }

  // First in the flex row is the rightmost button in the RTL card, so whatever
  // the failure points at leads. With no primary, retry keeps its usual place
  // and simply carries no emphasis.
  const actions =
    editAction && primary === editAction.action
      ? [editAction, retryAction]
      : [retryAction, ...(editAction ? [editAction] : [])]

  return (
    // Shrink-to-fit everywhere the buttons sit beside something, so they take
    // the room they need and no more. Stacked on the smallest phones they are
    // the only thing on their line, and matching the heading width reads as a
    // deliberate pair rather than as two buttons that failed to fit.
    <div className="flex flex-col items-end gap-2 max-[23rem]:items-stretch">
      {/* Side by side while they fit, wrapping when they do not. Beside the
          title this needs no threshold of its own: the heading caps the float
          at whatever the title leaves, so once two buttons no longer fit that
          width they wrap here by themselves, and `grow` widens each to the cap
          so a wrapped pair matches rather than sitting ragged. There is no
          slack to grow into while both share a line, because a float is only
          as wide as its contents ask for.

          They also stack on the smallest phones, where the buttons are below
          the message and there is no float to cap them: the pair needs about
          273px against the heading's 276px, near enough that rounding decides.
          Stacking is the honest answer there — a minimum card width would only
          make a 320px screen scroll sideways, which is worse. */}
      <div className="flex flex-row flex-wrap items-center justify-end gap-2 max-[23rem]:flex-col max-[23rem]:items-stretch">
        {actions.map(({ action, label, icon, onClick }) => (
          <Button
            key={action}
            type="button"
            size="sm"
            variant={action === primary ? "default" : "outline"}
            disabled={isRetrying}
            onClick={onClick}
            className="min-[499px]:grow"
          >
            {icon}
            {label}
          </Button>
        ))}
      </div>
      {/* Bounded so a long message cannot widen the heading and squeeze the
          title beside it; the card has no spare height to give. */}
      {retryState.status === "error" ? (
        <p role="alert" className="max-w-64 text-end text-sm text-destructive">
          {retryState.message}
        </p>
      ) : null}
    </div>
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

  // A failed fax restored after refresh has no non-failure history to show, and
  // an empty console box would only draw attention to nothing. Its space is
  // still reserved: the card cannot scroll, so releasing the height would let
  // the centred summary drop, and a fax failing mid-flight would jolt the rows
  // downward at the exact moment the customer is reading them. Reserving it as
  // an invisible copy keeps the two heights from drifting apart.
  if (isEmpty) {
    return (
      <div
        aria-hidden="true"
        className="invisible mx-auto flex w-full max-w-xl flex-col gap-2"
      >
        <h4 className="text-xs font-medium">פעילות</h4>
        <div className="h-24" />
      </div>
    )
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
