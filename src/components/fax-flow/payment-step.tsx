import { ArrowRight, Lock } from "lucide-react"

import { CardHeading } from "@/components/fax-flow/flow-card"
import { Button } from "@/components/ui/button"
import { CardContent } from "@/components/ui/card"

type PaymentStepProps = {
  fileSummary: string
  recipientSummary: string
  pageCount: number | null
  onBack: () => void
}

export function PaymentStep({
  fileSummary,
  recipientSummary,
  pageCount,
  onBack,
}: PaymentStepProps) {
  return (
    <>
      <CardHeading
        step={3}
        title="אישור ותשלום"
        description="עברו על הפרטים לפני פתיחת התשלום."
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
              ₪9.90
            </dd>
          </div>
        </dl>

        <div className="flex items-end justify-between gap-4">
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={onBack}
          >
            <ArrowRight data-icon="inline-start" />
            חזרה
          </Button>
          <div className="flex flex-col items-center gap-2">
            <Button type="button" size="lg" className="min-w-40">
              מעבר לתשלום
              <Lock data-icon="inline-end" />
            </Button>
            <span className="text-[0.7rem] text-muted-foreground">
              תצוגה חזותית בלבד
            </span>
          </div>
        </div>
      </CardContent>
    </>
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
