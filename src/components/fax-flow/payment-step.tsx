import { ArrowRight, CheckCircle2, Lock, Send } from "lucide-react"

import { CardHeading } from "@/components/fax-flow/flow-card"
import type { PaymentStartState } from "@/components/fax-flow/use-payment"
import { Button } from "@/components/ui/button"
import { CardContent } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import type {
  FaxSessionPayment,
  FaxSessionQuote,
} from "@/shared/session/fax-session.types"
import { PAYMENT_STATUS } from "@/shared/session/fax-session-status"

type PaymentStepProps = {
  fileSummary: string
  recipientSummary: string
  pageCount: number | null
  payment: FaxSessionPayment | null
  paymentStart: PaymentStartState
  quote: FaxSessionQuote | null
  /**
   * A session that already paid and has no delivery is being resent after a
   * failure was answered by editing the document or the number. The summary is
   * the same review it was the first time; only the commitment differs, so the
   * button sends instead of charging.
   */
  isResend: boolean
  isSending: boolean
  sendError: string | null
  onBack: () => void
  onStartPayment: () => void
  onSend: () => void
}

export function PaymentStep({
  fileSummary,
  recipientSummary,
  pageCount,
  payment,
  paymentStart,
  quote,
  isResend,
  isSending,
  sendError,
  onBack,
  onStartPayment,
  onSend,
}: PaymentStepProps) {
  const isStarting = paymentStart.status === "starting"
  const isPending = payment?.status === PAYMENT_STATUS.pending
  const isPaid = payment?.status === PAYMENT_STATUS.paid

  return (
    <>
      <CardHeading
        title="אישור ותשלום"
        description={
          isPaid
            ? "התשלום התקבל."
            : isPending
              ? "ממתינים לאישור התשלום."
              : "עברו על הפרטים לפני פתיחת התשלום."
        }
      />
      <CardContent className="flex min-h-0 flex-1 flex-col p-7">
        <dl className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4">
          <SummaryRow label="מסמך" value={fileSummary} ltr />
          <SummaryRow label="מספר פקס" value={recipientSummary} ltr />
          <SummaryRow
            label="עמודים"
            value={pageCount === null ? "—" : String(pageCount)}
          />
          {/* A resend is already paid for, so quoting a price again would read
              as a second charge. The line states what was settled instead. */}
          <div className="mt-1 flex items-baseline gap-3 border-t border-border pt-4">
            <dt className="font-medium">
              {isResend ? "התשלום" : "סה״כ לתשלום"}
            </dt>
            <span
              aria-hidden="true"
              className="flex-1 border-b border-dotted border-border"
            />
            {isResend ? (
              <dd className="flex items-center gap-2 text-base font-semibold text-success">
                <CheckCircle2 className="size-5" />
                שולם
              </dd>
            ) : (
              <dd dir="ltr" className="text-2xl font-bold tabular-nums">
                {formatFaxQuote(quote)}
              </dd>
            )}
          </div>
        </dl>

        <div className="flex items-end justify-between gap-4">
          <Button
            type="button"
            variant="ghost"
            size="lg"
            disabled={isStarting}
            onClick={onBack}
          >
            <ArrowRight data-icon="inline-start" />
            חזרה
          </Button>
          <div className="flex flex-col items-center gap-2">
            {isResend ? (
              <Button
                type="button"
                size="lg"
                disabled={isSending}
                onClick={onSend}
                className="min-w-40"
              >
                {isSending ? (
                  <>
                    <Spinner data-icon="inline-start" />
                    שולחים…
                  </>
                ) : (
                  <>
                    שליחת הפקס
                    <Send data-icon="inline-end" />
                  </>
                )}
              </Button>
            ) : isPaid ? (
              <div className="flex min-w-40 items-center justify-center gap-2 text-base font-semibold text-success">
                <CheckCircle2 className="size-5" />
                התשלום התקבל
              </div>
            ) : (
              <Button
                type="button"
                size="lg"
                disabled={!quote || isStarting || isPending}
                onClick={onStartPayment}
                className="min-w-40"
              >
                {isStarting || isPending ? (
                  <>
                    <Spinner data-icon="inline-start" />
                    ממתינים לאישור…
                  </>
                ) : (
                  <>
                    תשלום {formatFaxQuote(quote)}
                    <Lock data-icon="inline-end" />
                  </>
                )}
              </Button>
            )}
            {sendError ? (
              <p role="alert" className="max-w-64 text-center text-sm text-destructive">
                {sendError}
              </p>
            ) : null}
            {paymentStart.status === "error" ? (
              <span
                role="alert"
                className="max-w-64 text-center text-[0.7rem] text-destructive"
              >
                {paymentStart.message}
              </span>
            ) : isPending ? (
              <span className="text-[0.7rem] text-muted-foreground">
                האישור יוצג לאחר רענון העמוד בשלב זה
              </span>
            ) : null}
          </div>
        </div>
      </CardContent>
    </>
  )
}

/**
 * A whole-shekel price reads better as ₪10 than as ₪10.00, but a partial one
 * keeps both digits. `stripIfInteger` is what draws that line: dropping only
 * trailing zeros would render 9.90 as the awkward ₪9.9.
 */
const ILS_AMOUNT_FORMAT = new Intl.NumberFormat("he-IL", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  trailingZeroDisplay: "stripIfInteger",
})

export function formatFaxQuote(quote: FaxSessionQuote | null): string {
  if (!quote) {
    return "—"
  }

  // The Academy of the Hebrew Language places ₪ to the left of the number and
  // without a space, exactly as $ is placed, even though right-to-left text
  // then shows it after the digits.
  return quote.currency === "ILS"
    ? `₪${ILS_AMOUNT_FORMAT.format(Number(quote.amount))}`
    : quote.amount
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
