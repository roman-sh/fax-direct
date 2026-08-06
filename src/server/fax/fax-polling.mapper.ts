/**
 * Converts validated InterFAX polling records into the two application models
 * they update: provider facts in D1 and browser-facing progress in FaxSession.
 * Keeping this logic pure makes the provider's numeric protocol independent
 * from polling, persistence, and WebSocket delivery.
 */
import "server-only"

import type { FaxTransmissionRow } from "@/server/fax/fax-transmission.schema"
import type { UpdateFaxTransmission } from "@/server/fax/fax-transmission.repository"
import type { InterfaxFax } from "@/server/fax/interfax.schema"
import { FAX_STATUS } from "@/shared/session/fax-session-status"
import type {
  FaxFailureSemanticCode,
  FaxSessionFax,
} from "@/shared/session/fax-session.types"

const EMPTY_COMPLETION_TIME_PREFIX = "0001-01-01"
const DOCUMENTED_UNKNOWN_FAILURE_STATUS = 7200
const TEMPORARY_SERVICE_HOLD_STATUSES = new Set([-22])

const INTERFAX_FAILURE_STATUS_GROUPS: ReadonlyArray<
  readonly [FaxFailureSemanticCode, readonly number[]]
> = [
  ["BUSY", [263, 3931, 3937, 6017, 8025]],
  ["NO_ANSWER", [3935, 6018, 8021]],
  ["VOICE_ANSWERED", [3936]],
  ["INVALID_NUMBER", [6027]],
  [
    "DESTINATION_UNAVAILABLE",
    [3912, 3932, 3933, 3938, 6001, 6022, 6028],
  ],
  ["CALL_REJECTED", [488, 6021, 6029]],
  ["ROUTE_UNAVAILABLE", [6002]],
  [
    "FAX_INCOMPATIBLE",
    [
      3211, 3220, 3225, 3231, 3233, 3264, 3267, 3269, 6088, 6095, 6097,
      6099, 6100,
    ],
  ],
  ["TRANSMISSION_INTERRUPTED", [3223, 3224, 3230, 3268, 8010]],
  [
    "CONNECTION_FAILED",
    [
      2, 12, 101, 102, 104, 130, 132, 204, 483, 501, 603, 3072, 3080, 3300,
      3510, 3830, 6003, 6004, 6016, 6019, 6031, 6034, 6038, 6041, 6042,
      6043, 6044, 6047, 6050, 6054, 6057, 6058, 6063, 6065, 6069, 6079,
      6102, 6111, 6127, 7004, 7012, 7013, 9951, 9952, 9987, 9994, 9998,
      9999,
    ],
  ],
  ["DOCUMENT_PROCESSING_FAILED", [204000, 204001]],
  ["CANCELED", [403]],
  ["SERVICE_UNAVAILABLE", [1, 256, 205000, 205001, 206001]],
]

const INTERFAX_FAILURE_STATUS_MAP = new Map<number, FaxFailureSemanticCode>(
  INTERFAX_FAILURE_STATUS_GROUPS.flatMap(([semanticCode, statuses]) =>
    statuses.map((status) => [status, semanticCode] as const)
  )
)

type FaxProgressFacts = {
  providerStatus: number | null
  pagesSent: number
  pagesSubmitted: number
}

/** Maps one validated provider record into the D1 columns we retain. */
export function mapInterfaxFaxToTransmissionUpdate(
  fax: InterfaxFax
): UpdateFaxTransmission {
  return {
    providerStatus: fax.status,
    pagesSubmitted: fax.pagesSubmitted,
    pagesSent: fax.pagesSent,
    attemptsMade: fax.attemptsMade,
    attemptsTotal: fax.attemptsToPerform,
    completedAt: normalizeCompletionTime(fax.status, fax.completionTime),
  }
}

/** Derives the browser-facing progress and semantic failure from InterFAX. */
export function mapInterfaxFaxToSessionFax(fax: InterfaxFax): FaxSessionFax {
  return mapProgressFactsToSessionFax({
    providerStatus: fax.status,
    pagesSent: fax.pagesSent,
    pagesSubmitted: fax.pagesSubmitted,
  })
}

/** Reconstructs the public projection represented by the current D1 row. */
export function mapTransmissionRowToSessionFax(
  transmission: FaxTransmissionRow
): FaxSessionFax {
  return mapProgressFactsToSessionFax({
    providerStatus: transmission.providerStatus,
    pagesSent: transmission.pagesSent,
    pagesSubmitted: transmission.pagesSubmitted,
  })
}

/** Returns true when a provider poll contains D1 facts not already persisted. */
export function hasTransmissionChanged(
  current: FaxTransmissionRow,
  next: UpdateFaxTransmission
): boolean {
  return (
    current.providerStatus !== next.providerStatus ||
    current.pagesSubmitted !== next.pagesSubmitted ||
    current.pagesSent !== next.pagesSent ||
    current.attemptsMade !== next.attemptsMade ||
    current.attemptsTotal !== next.attemptsTotal ||
    current.completedAt !== next.completedAt
  )
}

/** Returns true when a poll changes anything visible to the browser. */
export function hasSessionFaxChanged(
  current: FaxSessionFax,
  next: FaxSessionFax
): boolean {
  return (
    current.status !== next.status ||
    current.pagesSent !== next.pagesSent ||
    current.pagesSubmitted !== next.pagesSubmitted ||
    current.error !== next.error
  )
}

/** Identifies an undocumented positive status for operational logging. */
export function isUndocumentedFailureStatus(status: number): boolean {
  return (
    status > 0 &&
    status !== DOCUMENTED_UNKNOWN_FAILURE_STATUS &&
    !INTERFAX_FAILURE_STATUS_MAP.has(status)
  )
}

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

/** Applies the business precedence documented in API.md. */
function mapProgressFactsToSessionFax(facts: FaxProgressFacts): FaxSessionFax {
  const { providerStatus, pagesSent, pagesSubmitted } = facts

  if (providerStatus === null) {
    return createSessionFax(FAX_STATUS.QUEUED, facts)
  }

  if (providerStatus === 0) {
    return createSessionFax(FAX_STATUS.DELIVERED, facts)
  }

  if (providerStatus > 0) {
    return createSessionFax(
      FAX_STATUS.FAILED,
      facts,
      classifyFailure(facts)
    )
  }

  if (TEMPORARY_SERVICE_HOLD_STATUSES.has(providerStatus)) {
    return createSessionFax(FAX_STATUS.SERVICE_DELAYED, facts)
  }

  // Sending every page is not delivery confirmation. InterFAX can continue
  // processing after N/N pages, so this remains a temporary finalizing state.
  if (pagesSubmitted > 0 && pagesSent >= pagesSubmitted) {
    return createSessionFax(FAX_STATUS.FINALIZING, facts)
  }

  return createSessionFax(FAX_STATUS.SENDING, facts)
}

/** Composite page rules take precedence over the provider's numeric reason. */
function classifyFailure(facts: FaxProgressFacts): FaxFailureSemanticCode {
  if (facts.pagesSubmitted > 0 && facts.pagesSent >= facts.pagesSubmitted) {
    return "DELIVERY_UNCONFIRMED"
  }

  if (facts.pagesSent > 0) {
    return "PARTIAL_TRANSMISSION"
  }

  return (
    INTERFAX_FAILURE_STATUS_MAP.get(facts.providerStatus ?? 0) ??
    "UNKNOWN_FAILURE"
  )
}

/** Builds the public fax shape while keeping successful states error-free. */
function createSessionFax(
  status: FaxSessionFax["status"],
  facts: FaxProgressFacts,
  error: FaxFailureSemanticCode | null = null
): FaxSessionFax {
  return {
    status,
    pagesSent: facts.pagesSent,
    pagesSubmitted: facts.pagesSubmitted,
    error,
  }
}

/** Removes InterFAX's sentinel and all non-final completion timestamps. */
function normalizeCompletionTime(
  status: number,
  completionTime: string
): string | null {
  if (status < 0 || completionTime.startsWith(EMPTY_COMPLETION_TIME_PREFIX)) {
    return null
  }

  return completionTime
}
