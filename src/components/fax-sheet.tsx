"use client"

import { useEffect, useRef, useState } from "react"
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Lock,
  MoveLeft,
  Phone,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import {
  validateIsraeliFaxNumber,
  type IsraeliFaxNumberValidationResult,
} from "@/shared/phone/validate-israeli-fax-number"

type InspectionResult = {
  pageCount: number
  price: {
    amount: string
    currency: string
  }
}

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
  const [file, setFile] = useState<File | null>(null)
  const [inspection, setInspection] = useState<InspectionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isInspecting, setIsInspecting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [recipient, setRecipient] = useState("")
  const [recipientError, setRecipientError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const dragDepthRef = useRef(0)

  useEffect(() => {
    return () => abortControllerRef.current?.abort()
  }, [])

  async function inspectSelectedFile(selectedFile: File) {
    abortControllerRef.current?.abort()

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    setFile(selectedFile)
    setInspection(null)
    setError(null)
    setIsInspecting(true)

    const formData = new FormData()
    formData.set("file", selectedFile)

    try {
      const response = await fetch("/api/pdf/inspect", {
        method: "POST",
        body: formData,
        signal: abortController.signal,
      })
      const payload: unknown = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(getErrorMessage(payload))
      }

      if (!isInspectionResult(payload)) {
        throw new Error("התקבלה תשובה לא תקינה מהשרת. נסו שוב.")
      }

      setInspection(payload)
    } catch (caughtError) {
      if (
        caughtError instanceof DOMException &&
        caughtError.name === "AbortError"
      ) {
        return
      }

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "לא הצלחנו לבדוק את הקובץ. נסו שוב."
      )
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null
        setIsInspecting(false)
      }
    }
  }

  function handleDragEnter(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    dragDepthRef.current += 1
    setIsDragging(true)
  }

  function handleDragLeave(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    dragDepthRef.current -= 1

    if (dragDepthRef.current === 0) {
      setIsDragging(false)
    }
  }

  function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    dragDepthRef.current = 0
    setIsDragging(false)

    const selectedFile = event.dataTransfer.files.item(0)

    if (selectedFile) {
      void inspectSelectedFile(selectedFile)
    }
  }

  function validateRecipient(): boolean {
    const result = validateIsraeliFaxNumber(recipient)

    if (!result.ok) {
      setRecipientError(getRecipientErrorMessage(result.code))
      return false
    }

    setRecipientError(null)
    return true
  }

  function handleRecipientChange(value: string) {
    setRecipient(value)

    if (recipientError) {
      const result = validateIsraeliFaxNumber(value)
      setRecipientError(
        result.ok ? null : getRecipientErrorMessage(result.code)
      )
    }
  }

  const displayedPrice = inspection
    ? formatPrice(inspection.price)
    : "₪9.90"

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
              {displayedPrice}
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
              onChange={(event) => {
                const selectedFile = event.currentTarget.files?.item(0)
                event.currentTarget.value = ""

                if (selectedFile) {
                  void inspectSelectedFile(selectedFile)
                }
              }}
            />
            <label
              htmlFor="fax-document"
              onDragEnter={handleDragEnter}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "group flex min-h-32 flex-1 cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-input bg-muted/70 p-5 text-center transition-colors hover:border-brand/60 hover:bg-brand-subtle/70 peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-ring/40 sm:min-h-36 sm:gap-5 sm:p-6",
                isDragging && "border-brand bg-brand-subtle/80",
                error && "border-destructive/60 bg-destructive/5",
                inspection && "border-success/60 bg-success-subtle/55"
              )}
            >
              {isInspecting ? (
                <span className="flex h-20 w-15 items-center justify-center rounded-md border border-border bg-card text-brand">
                  <Spinner className="size-6" aria-label="בודקים את הקובץ" />
                </span>
              ) : (
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
                    className={cn(
                      "absolute inset-0 flex items-center justify-center rounded-md border border-border bg-card text-brand",
                      error && "text-destructive",
                      inspection && "text-success"
                    )}
                  >
                    {error ? (
                      <AlertCircle className="size-6" />
                    ) : inspection ? (
                      <CheckCircle2 className="size-6" />
                    ) : (
                      <FileText className="size-6" />
                    )}
                  </span>
                </span>
              )}

              <span
                className="flex min-w-0 max-w-full flex-col gap-1"
                aria-live="polite"
              >
                <span
                  dir={inspection && file ? "ltr" : undefined}
                  title={file?.name}
                  className={cn(
                    "max-w-full truncate text-[0.95rem] font-semibold",
                    error && "text-destructive"
                  )}
                >
                  {isInspecting
                    ? "בודקים את הקובץ…"
                    : error
                      ? error
                      : inspection && file
                        ? file.name
                        : "גררו לכאן קובץ PDF"}
                </span>
                <span
                  dir={isInspecting && file ? "ltr" : undefined}
                  className="text-sm text-muted-foreground"
                >
                  {isInspecting
                    ? file?.name
                    : error
                      ? "לחצו או גררו קובץ אחר כדי לנסות שוב"
                      : inspection
                        ? `${inspection.pageCount} ${inspection.pageCount === 1 ? "עמוד" : "עמודים"} · לחצו להחלפת הקובץ`
                        : "או לחצו כדי לבחור קובץ מהמחשב"}
                </span>
              </span>

              <span className="font-mono text-[0.7rem] tracking-wide text-muted-foreground">
                {file && inspection
                  ? `${formatFileSize(file.size)} · PDF תקין`
                  : "PDF · עד 10 עמודים · עד 10MB"}
              </span>
            </label>
          </div>

          <div className="flex min-h-0 flex-col gap-4 border-t border-border bg-muted/35 p-4 sm:gap-5 sm:p-7 lg:border-t-0 lg:border-s">
            <div className="flex flex-col gap-3">
              <StepRule step="02" htmlFor="recipient-fax">
                מספר הפקס של הנמען
              </StepRule>
              <div
                className={cn(
                  "flex h-11 items-center gap-2.5 rounded-xl border border-input bg-card px-3 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/40",
                  recipientError &&
                    "border-destructive ring-3 ring-destructive/20 focus-within:border-destructive focus-within:ring-destructive/20"
                )}
              >
                <Phone
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground",
                    recipientError && "text-destructive"
                  )}
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
                  value={recipient}
                  onChange={(event) =>
                    handleRecipientChange(event.currentTarget.value)
                  }
                  onBlur={validateRecipient}
                  aria-invalid={Boolean(recipientError)}
                  aria-describedby="recipient-fax-description"
                  className="h-full border-0 bg-transparent px-0 text-end font-mono text-base tracking-wide placeholder:text-muted-foreground/45 focus-visible:border-0 focus-visible:ring-0 md:text-base dark:bg-transparent"
                />
              </div>
              <p
                id="recipient-fax-description"
                role={recipientError ? "alert" : undefined}
                className={cn(
                  "text-xs leading-relaxed text-muted-foreground",
                  recipientError && "text-destructive"
                )}
              >
                {recipientError ??
                  "מספר בישראל, כולל קידומת. אפשר להזין גם בפורמט בינלאומי."}
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
                  <dd
                    className={cn(
                      "font-mono text-muted-foreground",
                      inspection && "font-semibold text-foreground"
                    )}
                  >
                    {inspection?.pageCount ?? "—"}
                  </dd>
                </div>
                <div className="flex items-baseline gap-2">
                  <dt className="text-sm font-medium">סה״כ לתשלום</dt>
                  <span
                    aria-hidden="true"
                    className="flex-1 border-b border-dotted border-border"
                  />
                  <dd dir="ltr" className="text-xl font-bold tabular-nums">
                    {displayedPrice}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="mt-auto flex flex-col gap-2.5">
              <Button
                type="button"
                onClick={validateRecipient}
                className="h-11 w-full text-[0.95rem]"
              >
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

function getRecipientErrorMessage(
  code: Exclude<
    IsraeliFaxNumberValidationResult,
    { ok: true }
  >["code"]
): string {
  switch (code) {
    case "EMPTY":
      return "יש להזין מספר פקס."
    case "UNSUPPORTED_COUNTRY":
      return "בשלב זה ניתן לשלוח פקס למספרים בישראל בלבד."
    case "INVALID_NUMBER":
      return "מספר הפקס אינו תקין. בדקו את המספר ונסו שוב."
  }
}

function isInspectionResult(value: unknown): value is InspectionResult {
  if (!value || typeof value !== "object") {
    return false
  }

  const result = value as Partial<InspectionResult>

  return (
    Number.isInteger(result.pageCount) &&
    Boolean(result.price) &&
    typeof result.price?.amount === "string" &&
    typeof result.price.currency === "string"
  )
}

function getErrorMessage(value: unknown): string {
  if (
    value &&
    typeof value === "object" &&
    "message" in value &&
    typeof value.message === "string"
  ) {
    return value.message
  }

  return "לא הצלחנו לבדוק את הקובץ. נסו שוב."
}

function formatPrice(price: InspectionResult["price"]): string {
  return price.currency === "ILS"
    ? `₪${price.amount}`
    : `${price.amount} ${price.currency}`
}

function formatFileSize(bytes: number): string {
  const megabytes = bytes / 1024 / 1024

  return megabytes >= 1
    ? `${megabytes.toFixed(1)}MB`
    : `${Math.max(1, Math.round(bytes / 1024))}KB`
}
