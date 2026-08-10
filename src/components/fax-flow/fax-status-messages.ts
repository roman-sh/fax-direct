import { IntlMessageFormat } from "intl-messageformat"

import type {
  FaxFailureSemanticCode,
  FaxSessionFax,
} from "@/shared/session/fax-session.types"
import { FAX_STATUS } from "@/shared/session/fax-session-status"

/**
 * The locale is enforced by the Server Component that renders the page. The
 * client never infers it from WebSocket data, which stays language-neutral.
 */
export type FaxUiLocale = "he-IL" | "en-US"

/**
 * Keys for non-failure lines. `sending` splits in two because connecting and
 * page progress read as different sentences. `paymentPaid` covers the window
 * where payment is confirmed but the fax record does not exist yet; the
 * payment-pending message is rendered by `PaymentStep` before this view
 * mounts, so it has no key here.
 */
export type FaxProgressMessageKey =
  | "paymentPaid"
  | "preparing"
  | "queued"
  | "sendingConnecting"
  | "sendingProgress"
  | "finalizing"
  | "serviceDelayed"
  | "delivered"

type FaxMessageTemplates = {
  progress: Record<FaxProgressMessageKey, string>
  failure: Record<FaxFailureSemanticCode, string>
}

/**
 * Complete sentences live inside these templates. Application code selects a
 * template and interpolates values; it never assembles Hebrew fragments.
 * Hebrew plurals need explicit `=1` (singular) and `=2` (dual) branches.
 */
const TEMPLATES_BY_LOCALE: Record<FaxUiLocale, FaxMessageTemplates> = {
  "he-IL": {
    progress: {
      paymentPaid: "התשלום התקבל. מתחילים את השליחה.",
      preparing: "מכינים את המסמך לשליחה.",
      queued: "הפקס התקבל וממתין לשליחה.",
      sendingConnecting: "מתחברים למספר הפקס.",
      sendingProgress: `{pagesSent, plural,
        =1 {נשלח עמוד אחד מתוך {pagesSubmitted, plural, =1 {עמוד אחד} =2 {שניים} other {# עמודים}}.}
        =2 {נשלחו שני עמודים מתוך {pagesSubmitted, plural, =2 {שניים} other {# עמודים}}.}
        other {נשלחו # מתוך {pagesSubmitted} עמודים.}
      }`,
      finalizing: "כל עמודי המסמך שודרו. ממתינים לאישור המסירה.",
      serviceDelayed: "השליחה מתעכבת עקב תקלה זמנית בשירות. נמשיך לבדוק.",
      // "נמסר" (delivered), not "נשלח" (sent): transmission never implies
      // delivery, and this line only renders on confirmed delivery.
      delivered: "הפקס נמסר בהצלחה.",
    },
    failure: {
      BUSY: "הקו תפוס. נסו שוב מאוחר יותר.",
      NO_ANSWER: "אין מענה במספר. בדקו את המספר ונסו שוב.",
      VOICE_ANSWERED:
        "השיחה נענתה, אך לא זוהה מכשיר פקס. בדקו את המספר.",
      INVALID_NUMBER: "מספר הפקס אינו תקין. בדקו את המספר ונסו שנית.",
      DESTINATION_UNAVAILABLE:
        "המספר אינו זמין. בדקו את המספר ונסו שנית.",
      CALL_REJECTED: "השיחה נדחתה. בדקו את המספר ונסו שוב.",
      ROUTE_UNAVAILABLE: "הניתוב נכשל. נסו שוב מאוחר יותר.",
      FAX_INCOMPATIBLE: "התקשורת נכשלה. בדקו את המספר ונסו שנית.",
      TRANSMISSION_INTERRUPTED:
        "השליחה נקטעה לפני שהסתיימה. נסו שוב.",
      CONNECTION_FAILED: "חיבור לפקס נכשל. בדקו את המספר ונסו שוב.",
      DOCUMENT_PROCESSING_FAILED:
        "הכנת המסמך נכשלה. העלו קובץ PDF אחר.",
      CANCELED: "השליחה בוטלה. נסו שוב מאוחר יותר.",
      SERVICE_UNAVAILABLE: "השירות אינו זמין כעת. נסו שוב מאוחר יותר.",
      UNKNOWN_FAILURE: "השליחה נכשלה. בדקו את המספר ונסו שוב.",
      DELIVERY_UNCONFIRMED:
        "כל העמודים הועברו, אך אישור מסירה לא התקבל. ייתכן שהנמען כבר קיבל את המסמך כולו; בדקו איתו לפני שליחה מחדש.",
      PARTIAL_TRANSMISSION: `{pagesSent, plural,
        one {השליחה נכשלה לאחר שנשלח עמוד אחד מתוך {pagesSubmitted}. ייתכן שהנמען קיבל חלק מהמסמך; בדקו איתו לפני שליחה מחדש.}
        two {השליחה נכשלה לאחר שנשלחו שני עמודים מתוך {pagesSubmitted}. ייתכן שהנמען קיבל חלק מהמסמך; בדקו איתו לפני שליחה מחדש.}
        other {השליחה נכשלה לאחר שנשלחו {pagesSent} מתוך {pagesSubmitted} עמודים. ייתכן שהנמען קיבל חלק מהמסמך; בדקו איתו לפני שליחה מחדש.}
      }`,
    },
  },
  "en-US": {
    progress: {
      paymentPaid: "Payment received. Starting the fax delivery.",
      preparing: "Preparing the document for delivery.",
      queued: "The fax is queued for delivery.",
      sendingConnecting: "Connecting to the fax number.",
      sendingProgress: `{pagesSent, plural,
        one {Sent # page of {pagesSubmitted}.}
        other {Sent # of {pagesSubmitted} pages.}
      }`,
      finalizing:
        "All pages were transmitted. Waiting for final delivery confirmation.",
      serviceDelayed:
        "Delivery is delayed by a temporary service issue. We will keep checking.",
      delivered: "The fax was delivered successfully.",
    },
    failure: {
      BUSY: "The line is busy. Try again later.",
      NO_ANSWER: "No answer at the number. Check the number and try again.",
      VOICE_ANSWERED:
        "The call was answered, but no fax machine was detected. Check the number.",
      INVALID_NUMBER:
        "The fax number is not valid. Check the number and try again.",
      DESTINATION_UNAVAILABLE:
        "The number is unavailable. Check the number and try again.",
      CALL_REJECTED: "The call was rejected. Check the number and try again.",
      ROUTE_UNAVAILABLE: "Routing failed. Try again later.",
      FAX_INCOMPATIBLE:
        "The fax communication failed. Check the number and try again.",
      TRANSMISSION_INTERRUPTED:
        "The delivery was cut off before it finished. Try again.",
      CONNECTION_FAILED:
        "Connecting to the fax failed. Check the number and try again.",
      DOCUMENT_PROCESSING_FAILED:
        "Preparing the document failed. Upload a different PDF file.",
      CANCELED: "The delivery was cancelled. Try again later.",
      SERVICE_UNAVAILABLE:
        "The service is unavailable right now. Try again later.",
      UNKNOWN_FAILURE: "The delivery failed. Check the number and try again.",
      DELIVERY_UNCONFIRMED:
        "All pages were transmitted, but no delivery confirmation arrived. The recipient may already have the whole document; check with them before resending.",
      PARTIAL_TRANSMISSION: `{pagesSent, plural,
        one {The delivery failed after one page of {pagesSubmitted} was sent. The recipient may have received part of the document; check with them before resending.}
        other {The delivery failed after {pagesSent} of {pagesSubmitted} pages were sent. The recipient may have received part of the document; check with them before resending.}
      }`,
    },
  },
}

export type FaxMessageFormatters = {
  progressStatusToMessageMap: Record<FaxProgressMessageKey, IntlMessageFormat>
  semanticCodeToMessageMap: Record<FaxFailureSemanticCode, IntlMessageFormat>
}

const formattersCache = new Map<FaxUiLocale, FaxMessageFormatters>()

function compileTemplates<Key extends string>(
  templates: Record<Key, string>,
  locale: FaxUiLocale
): Record<Key, IntlMessageFormat> {
  const compiled = {} as Record<Key, IntlMessageFormat>

  for (const key of Object.keys(templates) as Key[]) {
    compiled[key] = new IntlMessageFormat(templates[key], locale)
  }

  return compiled
}

/** Creates both typed formatter maps once per locale and reuses them. */
export function createFaxMessageFormatters(
  locale: FaxUiLocale
): FaxMessageFormatters {
  const cached = formattersCache.get(locale)

  if (cached) {
    return cached
  }

  const templates = TEMPLATES_BY_LOCALE[locale]
  const formatters: FaxMessageFormatters = {
    progressStatusToMessageMap: compileTemplates(templates.progress, locale),
    semanticCodeToMessageMap: compileTemplates(templates.failure, locale),
  }

  formattersCache.set(locale, formatters)

  return formatters
}

/**
 * Fingerprints one authoritative snapshot. The poller rebroadcasts identical
 * snapshots every ten seconds, so the activity feed appends only when this
 * value changes.
 */
export function getFaxSnapshotFingerprint(
  fax: FaxSessionFax | null
): string {
  if (!fax) {
    return "payment:paid"
  }

  return `${fax.status}:${fax.pagesSent}:${fax.pagesSubmitted}:${fax.error ?? ""}`
}

/** Returns the single localized line describing one session snapshot. */
export function formatFaxSnapshotMessage(
  fax: FaxSessionFax | null,
  formatters: FaxMessageFormatters
): string {
  const { progressStatusToMessageMap, semanticCodeToMessageMap } = formatters

  if (!fax) {
    return String(progressStatusToMessageMap.paymentPaid.format())
  }

  switch (fax.status) {
    case FAX_STATUS.PREPARING:
      return String(progressStatusToMessageMap.preparing.format())
    case FAX_STATUS.QUEUED:
      return String(progressStatusToMessageMap.queued.format())
    case FAX_STATUS.SENDING:
      if (fax.pagesSent > 0) {
        return String(
          progressStatusToMessageMap.sendingProgress.format({
            pagesSent: fax.pagesSent,
            pagesSubmitted: fax.pagesSubmitted,
          })
        )
      }

      return String(progressStatusToMessageMap.sendingConnecting.format())
    case FAX_STATUS.FINALIZING:
      return String(progressStatusToMessageMap.finalizing.format())
    case FAX_STATUS.SERVICE_DELAYED:
      return String(progressStatusToMessageMap.serviceDelayed.format())
    case FAX_STATUS.DELIVERED:
      return String(progressStatusToMessageMap.delivered.format())
    case FAX_STATUS.FAILED: {
      // A failed snapshot without a semantic code is invalid; the activity-log
      // hook reports it once. Formatting stays side-effect free because this
      // runs during render.
      const code = fax.error ?? "UNKNOWN_FAILURE"

      return String(
        semanticCodeToMessageMap[code].format({
          pagesSent: fax.pagesSent,
          pagesSubmitted: fax.pagesSubmitted,
        })
      )
    }
  }
}
