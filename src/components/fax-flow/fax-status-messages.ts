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
      BUSY: "מספר הפקס תפוס כרגע. אפשר לנסות שוב מאוחר יותר.",
      NO_ANSWER: "מספר הפקס לא ענה. בדקו את המספר או נסו שוב מאוחר יותר.",
      VOICE_ANSWERED:
        "השיחה נענתה, אך לא זוהה מכשיר פקס. בדקו את המספר לפני ניסיון נוסף.",
      INVALID_NUMBER: "מספר הפקס אינו תקין. בדקו את המספר ונסו שוב.",
      DESTINATION_UNAVAILABLE:
        "לא ניתן לחייג למספר הפקס. בדקו שהמספר פעיל ותקין.",
      CALL_REJECTED:
        "היעד דחה את השיחה. בדקו את המספר או נסו שוב מאוחר יותר.",
      ROUTE_UNAVAILABLE:
        "לא ניתן כרגע לנתב את השליחה למספר הזה. בדקו את המספר או נסו שוב מאוחר יותר.",
      FAX_INCOMPATIBLE:
        "נוצר קשר עם מכשיר הפקס, אך התקשורת איתו נכשלה. אפשר לנסות שוב.",
      TRANSMISSION_INTERRUPTED:
        "החיבור נותק לפני שהשליחה הושלמה. אפשר לנסות שוב.",
      CONNECTION_FAILED:
        "לא הצלחנו ליצור קשר עם מספר הפקס. בדקו את המספר או נסו שוב מאוחר יותר.",
      DOCUMENT_PROCESSING_FAILED:
        "לא הצלחנו להכין את המסמך לשליחה. נסו להעלות קובץ PDF אחר.",
      CANCELED: "שליחת הפקס בוטלה.",
      SERVICE_UNAVAILABLE:
        "לא הצלחנו לשלוח את הפקס עקב תקלה זמנית בשירות. נסו שוב מאוחר יותר.",
      UNKNOWN_FAILURE:
        "שליחת הפקס נכשלה מסיבה לא ידועה. בדקו את המספר או נסו שוב מאוחר יותר.",
      DELIVERY_UNCONFIRMED:
        "כל עמודי המסמך שודרו, אך לא התקבל אישור מסירה סופי. מומלץ לבדוק מול הנמען לפני ניסיון נוסף.",
      PARTIAL_TRANSMISSION: `{pagesSent, plural,
        =1 {השליחה נכשלה לאחר שנשלח עמוד אחד מתוך {pagesSubmitted}. ייתכן שחלק מהמסמך התקבל.}
        =2 {השליחה נכשלה לאחר שנשלחו שני עמודים מתוך {pagesSubmitted}. ייתכן שחלק מהמסמך התקבל.}
        other {השליחה נכשלה לאחר שנשלחו # מתוך {pagesSubmitted} עמודים. ייתכן שחלק מהמסמך התקבל.}
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
      BUSY: "The fax number is busy. Try again later.",
      NO_ANSWER:
        "The fax number did not answer. Check the number or try again later.",
      VOICE_ANSWERED:
        "The call was answered, but no fax machine was detected. Check the number before retrying.",
      INVALID_NUMBER: "The fax number is invalid. Check it and try again.",
      DESTINATION_UNAVAILABLE:
        "The fax number cannot be reached. Check that it is active and correct.",
      CALL_REJECTED:
        "The destination rejected the call. Check the number or try again later.",
      ROUTE_UNAVAILABLE:
        "Delivery cannot currently be routed to this number. Check it or try again later.",
      FAX_INCOMPATIBLE:
        "A fax machine answered, but fax communication failed. You can try again.",
      TRANSMISSION_INTERRUPTED:
        "The connection ended before delivery was complete. You can try again.",
      CONNECTION_FAILED:
        "We could not connect to the fax number. Check it or try again later.",
      DOCUMENT_PROCESSING_FAILED:
        "We could not prepare the document. Try uploading a different PDF.",
      CANCELED: "Fax delivery was canceled.",
      SERVICE_UNAVAILABLE:
        "A temporary service problem prevented delivery. Try again later.",
      UNKNOWN_FAILURE:
        "Fax delivery failed for an unknown reason. Check the number or try again later.",
      DELIVERY_UNCONFIRMED:
        "All pages were transmitted, but final delivery was not confirmed. Check with the recipient before retrying.",
      PARTIAL_TRANSMISSION: `{pagesSent, plural,
        one {Delivery failed after # page was transmitted out of {pagesSubmitted}. The recipient may have received part of the document.}
        other {Delivery failed after # of {pagesSubmitted} pages were transmitted. The recipient may have received part of the document.}
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
