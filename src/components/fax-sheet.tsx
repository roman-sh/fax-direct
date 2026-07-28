import { FileText, Lock, MoveLeft, Phone } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function StepRule({
  step,
  htmlFor,
  children,
}: {
  step: string
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span aria-hidden="true" className="font-mono text-xs text-brand">
        {step}
      </span>
      {htmlFor ? (
        <Label htmlFor={htmlFor} className="text-sm font-semibold">
          {children}
        </Label>
      ) : (
        <span className="text-sm font-semibold">{children}</span>
      )}
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
    </div>
  )
}

export function FaxSheet() {
  return (
    <Card className="w-full max-w-5xl gap-0 py-0 shadow-[0_1px_2px_oklch(0.198_0.01_65/0.06),0_20px_48px_-24px_oklch(0.198_0.01_65/0.28)]">
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-3 sm:px-7">
          <span className="text-xs font-medium tracking-wide text-muted-foreground">
            טופס שליחת פקס
          </span>
          <span className="text-xs text-muted-foreground">
            מחיר אחיד ·{" "}
            <span
              dir="ltr"
              className="font-semibold tabular-nums text-foreground"
            >
              ₪9.90
            </span>
          </span>
        </div>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[1.15fr_1fr]">
          <div className="flex min-h-0 flex-col gap-3.5 p-4 sm:p-7">
            <StepRule step="01" htmlFor="fax-document">
              המסמך לשליחה
            </StepRule>

            <input
              id="fax-document"
              name="document"
              type="file"
              accept="application/pdf,.pdf"
              className="peer sr-only"
            />
            <label
              htmlFor="fax-document"
              className="group flex min-h-32 flex-1 cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-input bg-muted/70 p-5 text-center transition-colors hover:border-brand/60 hover:bg-brand-subtle/70 peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-ring/40 sm:gap-5 sm:p-6 sm:min-h-36"
            >
              <span className="relative block h-20 w-15 transition-transform group-hover:-translate-y-0.5">
                <span
                  aria-hidden="true"
                  className="absolute inset-0 -rotate-12 rounded-md border border-input bg-background"
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-0 rotate-6 rounded-md border border-input bg-background"
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-0 flex items-center justify-center rounded-md border border-border bg-card text-brand"
                >
                  <FileText className="size-6" />
                </span>
              </span>

              <span className="flex flex-col gap-1">
                <span className="text-[0.95rem] font-semibold">
                  גררו לכאן קובץ PDF
                </span>
                <span className="text-sm text-muted-foreground">
                  או לחצו כדי לבחור קובץ מהמחשב
                </span>
              </span>

              <span className="font-mono text-[0.7rem] tracking-wide text-muted-foreground">
                PDF · עד 10 עמודים · עד 10MB
              </span>
            </label>
          </div>

          <div className="flex min-h-0 flex-col gap-4 border-t border-border bg-muted/35 p-4 sm:gap-5 sm:p-7 lg:border-t-0 lg:border-s">
            <div className="flex flex-col gap-3">
              <StepRule step="02" htmlFor="recipient-fax">
                מספר הפקס של הנמען
              </StepRule>
              <div className="flex h-11 items-center gap-2.5 rounded-xl border border-input bg-card px-3 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/40">
                <Phone
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="recipient-fax"
                  name="recipient"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  dir="ltr"
                  placeholder="03-1234567"
                  className="h-full border-0 bg-transparent px-0 text-end font-mono text-base tracking-wide placeholder:text-muted-foreground/45 focus-visible:border-0 focus-visible:ring-0 md:text-base dark:bg-transparent"
                />
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                מספר בישראל כולל קידומת אזור. לא ניתן לשלוח למספרי נייד.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <StepRule step="03">תשלום ושליחה</StepRule>
              <dl className="flex flex-col gap-2.5">
                <div className="flex items-baseline gap-2 text-sm">
                  <dt className="text-muted-foreground">עמודים</dt>
                  <span
                    aria-hidden="true"
                    className="flex-1 border-b border-dotted border-border"
                  />
                  <dd className="font-mono text-muted-foreground">—</dd>
                </div>
                <div className="flex items-baseline gap-2">
                  <dt className="text-sm font-medium">סה״כ לתשלום</dt>
                  <span
                    aria-hidden="true"
                    className="flex-1 border-b border-dotted border-border"
                  />
                  <dd dir="ltr" className="text-xl font-bold tabular-nums">
                    ₪9.90
                  </dd>
                </div>
              </dl>
            </div>

            <div className="mt-auto flex flex-col gap-2.5">
              <Button className="h-11 w-full text-[0.95rem]">
                שליחת הפקס
                <MoveLeft data-icon="inline-end" aria-hidden="true" />
              </Button>
              <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="size-3 shrink-0" aria-hidden="true" />
                לא נגבה תשלום לפני שתאשרו את הפרטים
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
