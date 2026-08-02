"use client"

import { useState } from "react"
import { ArrowLeft, ArrowRight, Phone } from "lucide-react"

import { CardHeading } from "@/components/fax-flow/flow-card"
import { Button } from "@/components/ui/button"
import { CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  validateIsraeliFaxNumber,
  type IsraeliFaxNumberValidationResult,
} from "@/shared/phone/validate-israeli-fax-number"

type RecipientStepProps = {
  recipient: string
  onRecipientChange: (recipient: string) => void
  onBack: () => void
  onContinue: () => void
}

export function RecipientStep({
  recipient,
  onRecipientChange,
  onBack,
  onContinue,
}: RecipientStepProps) {
  const [touched, setTouched] = useState(false)
  const validation = validateIsraeliFaxNumber(recipient)
  const error =
    touched && !validation.ok
      ? getRecipientErrorMessage(validation.code)
      : null

  return (
    <>
      <CardHeading
        step={2}
        title="מספר הפקס של הנמען"
        description="הזינו מספר בישראל, כולל קידומת."
      />
      <CardContent className="flex min-h-0 flex-1 flex-col p-7">
        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-3">
          <div
            className={cn(
              "flex h-14 items-center gap-3 rounded-xl border border-input bg-card px-4 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/40",
              error &&
                "border-destructive/60 focus-within:border-destructive focus-within:ring-destructive/20"
            )}
          >
            <Phone
              className="size-5 shrink-0 text-muted-foreground"
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
              aria-describedby="recipient-fax-help"
              aria-invalid={error ? true : undefined}
              value={recipient}
              onChange={(event) => {
                onRecipientChange(event.currentTarget.value)
              }}
              onBlur={() => setTouched(true)}
              className="h-full border-0 bg-transparent px-0 text-end font-mono text-lg tracking-wide placeholder:text-muted-foreground/40 focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
            />
          </div>
          <p
            id="recipient-fax-help"
            aria-live="polite"
            className={cn(
              "text-xs leading-relaxed text-muted-foreground",
              error && "text-destructive"
            )}
          >
            {error ?? "אפשר להזין גם מספר ישראלי בפורמט בינלאומי."}
          </p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={onBack}
          >
            <ArrowRight data-icon="inline-start" />
            חזרה
          </Button>
          <Button
            type="button"
            size="lg"
            disabled={!validation.ok}
            onClick={onContinue}
            className="min-w-32"
          >
            המשך
            <ArrowLeft data-icon="inline-end" />
          </Button>
        </div>
      </CardContent>
    </>
  )
}

function getRecipientErrorMessage(
  code: Exclude<IsraeliFaxNumberValidationResult, { ok: true }>["code"]
): string {
  switch (code) {
    case "EMPTY":
      return "יש להזין מספר פקס."
    case "INVALID_NUMBER":
      return "מספר הפקס אינו תקין. בדקו את המספר ונסו שוב."
    case "UNSUPPORTED_COUNTRY":
      return "בשלב זה ניתן לשלוח פקס רק למספר ישראלי."
  }
}
