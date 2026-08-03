import { ArrowRight, CheckCircle2, Lock } from "lucide-react"

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
  onBack: () => void
  onStartPayment: () => void
}

export function PaymentStep({
  fileSummary,
  recipientSummary,
  pageCount,
  payment,
  paymentStart,
  quote,
  onBack,
  onStartPayment,
}: PaymentStepProps) {
  const isStarting = paymentStart.status === "starting"
  const isPending = payment?.status === PAYMENT_STATUS.PENDING
  const isPaid = payment?.status === PAYMENT_STATUS.PAID

  return (
    <>
      <CardHeading
        step={3}
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
          <div className="mt-1 flex items-baseline gap-3 border-t border-border pt-4">
            <dt className="font-medium">סה״כ לתשלום</dt>
            <span
              aria-hidden="true"
              className="flex-1 border-b border-dotted border-border"
            />
            <dd dir="ltr" className="text-2xl font-bold tabular-nums">
              {formatFaxQuote(quote)}
            </dd>
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
            {isPaid ? (
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

export function formatFaxQuote(quote: FaxSessionQuote | null): string {
  if (!quote) {
    return "—"
  }

  return quote.currency === "ILS" ? `₪${quote.amount}` : quote.amount
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
