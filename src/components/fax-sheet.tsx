"use client"

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type ReactNode,
} from "react"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  CreditCard,
  FileText,
  Lock,
  Phone,
  Upload,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import {
  validateIsraeliFaxNumber,
  type IsraeliFaxNumberValidationResult,
} from "@/shared/phone/validate-israeli-fax-number"

type Step = 1 | 2 | 3

type PdfInspectionState =
  | { status: "empty" }
  | { status: "inspecting" }
  | { status: "valid"; pageCount: number }
  | { status: "invalid"; message: string }

type FlowCardProps = {
  step: Step
  activeStep: Step
  title: string
  summary: string
  icon: ReactNode
  children: ReactNode
  onOpen: (step: Step) => void
}

function FlowCard({
  step,
  activeStep,
  title,
  summary,
  icon,
  children,
  onOpen,
}: FlowCardProps) {
  const isActive = step === activeStep
  const isComplete = step < activeStep
  const state = isActive ? "active" : isComplete ? "complete" : "future"
  const cardStyle = {
    flexBasis: isActive ? "0rem" : "5rem",
    flexGrow: isActive ? 1 : 0,
    zIndex: 30 - Math.abs(step - activeStep),
  } satisfies CSSProperties

  return (
    <Card
      data-state={state}
      style={cardStyle}
      className={cn(
        "relative min-w-0 gap-0 overflow-hidden py-0 transition-[flex-basis,flex-grow,transform,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        "hidden h-full ring-1 ring-foreground/12 lg:flex",
        step > 1 && "lg:-mr-3",
        isActive &&
          "flex flex-1 shadow-[0_1px_2px_oklch(0.198_0.01_65/0.08),0_28px_64px_-30px_oklch(0.198_0.01_65/0.35)]",
        isComplete &&
          "translate-y-2 bg-card shadow-[0_12px_32px_-24px_oklch(0.198_0.01_65/0.35)]",
        state === "future" &&
          "translate-y-4 bg-[color-mix(in_oklch,var(--card),var(--muted)_35%)] shadow-[0_10px_26px_-24px_oklch(0.198_0.01_65/0.3)]"
      )}
    >
      <div
        className={cn(
          "absolute inset-0 flex flex-col transition-opacity duration-150",
          isActive
            ? "pointer-events-auto opacity-100 delay-150"
            : "pointer-events-none opacity-0"
        )}
        aria-hidden={!isActive}
      >
        {children}
      </div>

      <button
        type="button"
        disabled={!isComplete}
        onClick={() => onOpen(step)}
        className={cn(
          "absolute inset-0 hidden w-full flex-col items-center gap-3 overflow-hidden px-2 py-5 transition-opacity duration-150 lg:flex",
          isActive
            ? "pointer-events-none opacity-0"
            : "pointer-events-auto opacity-100 delay-150",
          isComplete
            ? "text-foreground hover:bg-brand-subtle/45"
            : "cursor-default text-muted-foreground"
        )}
        aria-label={isComplete ? `חזרה לשלב ${step}: ${title}` : title}
      >
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
            isComplete
              ? "border-success/30 bg-success-subtle text-success"
              : "border-border bg-muted text-muted-foreground"
          )}
        >
          {isComplete ? <Check className="size-4" /> : step}
        </span>

        <span
          aria-hidden="true"
          className="h-8 w-px shrink-0 bg-border"
        />

        <span className="relative min-h-0 w-full flex-1 overflow-hidden">
          <span
            dir={isComplete ? "ltr" : "rtl"}
            className={cn(
              "absolute top-1/2 left-1/2 block max-w-72 -translate-x-1/2 -translate-y-1/2 -rotate-90 truncate whitespace-nowrap",
              isComplete
                ? "font-mono text-xs font-medium"
                : "text-xs font-semibold"
            )}
          >
            {isComplete ? summary : title}
          </span>
        </span>

        <span className="shrink-0 text-muted-foreground">{icon}</span>
      </button>
    </Card>
  )
}

function CardHeading({
  step,
  title,
  description,
}: {
  step: Step
  title: string
  description: string
}) {
  return (
    <CardHeader className="border-b border-border px-7 py-5">
      <div className="flex items-start gap-3">
        <span className="font-mono text-xs font-medium text-brand">
          0{step}
        </span>
        <div className="min-w-0">
          <CardTitle className="text-lg font-semibold">{title}</CardTitle>
          <CardDescription className="mt-1">{description}</CardDescription>
        </div>
      </div>
    </CardHeader>
  )
}

export function FaxSheet({
  maxFileBytes,
  maxPages,
}: {
  maxFileBytes: number
  maxPages: number
}) {
  const [activeStep, setActiveStep] = useState<Step>(1)
  const [file, setFile] = useState<File | null>(null)
  const [pdfInspection, setPdfInspection] =
    useState<PdfInspectionState>({ status: "empty" })
  const [recipient, setRecipient] = useState("")
  const [recipientTouched, setRecipientTouched] = useState(false)
  const inspectionSequence = useRef(0)
  const sessionInitializationStarted = useRef(false)

  useEffect(() => {
    if (sessionInitializationStarted.current) {
      return
    }

    sessionInitializationStarted.current = true

    void fetch("/api/session", {
      method: "POST",
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Session initialization failed: ${response.status}`)
        }
      })
      .catch((error: unknown) => {
        console.error("Could not initialize fax session:", error)
      })
  }, [])

  const fileSummary = file?.name ?? "document.pdf"
  const recipientSummary = recipient.trim() || "מספר הנמען"
  const isPdfValid = pdfInspection.status === "valid"
  const recipientValidation = validateIsraeliFaxNumber(recipient)
  const isRecipientValid = recipientValidation.ok
  const recipientError =
    recipientTouched && !recipientValidation.ok
      ? getRecipientErrorMessage(recipientValidation.code)
      : null
  const pageCount =
    pdfInspection.status === "valid" ? pdfInspection.pageCount : null

  function selectFile(nextFile: File | null) {
    const sequence = ++inspectionSequence.current

    setFile(nextFile)

    if (!nextFile) {
      setPdfInspection({ status: "empty" })
      return
    }

    setPdfInspection({ status: "inspecting" })

    void inspectSelectedFile(nextFile, sequence)
  }

  async function inspectSelectedFile(
    selectedFile: File,
    sequence: number
  ) {
    try {
      const { inspectPdfFile } = await import("@/shared/pdf/inspect-pdf")
      const result = await inspectPdfFile(selectedFile, {
        maxFileBytes,
        maxPages,
      })

      if (inspectionSequence.current === sequence) {
        setPdfInspection({
          status: "valid",
          pageCount: result.pageCount,
        })
      }
    } catch (error) {
      if (inspectionSequence.current !== sequence) {
        return
      }

      setPdfInspection({
        status: "invalid",
        message:
          error instanceof Error && error.name === "PdfInspectionError"
            ? error.message
            : "לא הצלחנו לבדוק את הקובץ. נסו שוב.",
      })
    }
  }

  function handleFileDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    selectFile(event.dataTransfer.files.item(0))
  }

  return (
    <section
      className="w-full max-w-6xl"
      aria-label="תצוגת תהליך שליחת פקס"
    >
      <div className="flex h-[31rem] w-full items-start lg:h-[27rem]">
        <FlowCard
          step={1}
          activeStep={activeStep}
          title="המסמך לשליחה"
          summary={fileSummary}
          icon={<FileText className="size-4" />}
          onOpen={setActiveStep}
        >
          <CardHeading
            step={1}
            title="בחירת המסמך"
            description="בחרו את קובץ ה־PDF שתרצו לשלוח."
          />
          <CardContent className="flex min-h-0 flex-1 flex-col gap-5 p-7">
            <input
              id="fax-document"
              type="file"
              accept="application/pdf,.pdf"
              className="peer sr-only"
              onChange={(event) => {
                selectFile(event.currentTarget.files?.item(0) ?? null)
              }}
            />
            <label
              htmlFor="fax-document"
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleFileDrop}
              className={cn(
                "group flex min-h-0 flex-1 cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-input bg-muted/65 p-6 text-center transition-colors",
                "hover:border-brand/60 hover:bg-brand-subtle/60 peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-ring/40",
                isPdfValid && "border-success/45 bg-success-subtle/45",
                pdfInspection.status === "invalid" &&
                  "border-destructive/45 bg-destructive/5"
              )}
            >
              <span
                className={cn(
                  "flex size-16 items-center justify-center rounded-2xl border border-border bg-card text-brand shadow-sm transition-transform group-hover:-translate-y-0.5",
                  isPdfValid && "text-success",
                  pdfInspection.status === "invalid" && "text-destructive"
                )}
              >
                {pdfInspection.status === "inspecting" ? (
                  <Spinner className="size-7" />
                ) : pdfInspection.status === "invalid" ? (
                  <CircleAlert className="size-7" />
                ) : file ? (
                  <FileText className="size-7" />
                ) : (
                  <Upload className="size-7" />
                )}
              </span>
              <span className="flex max-w-full flex-col gap-1">
                <span
                  dir={file ? "ltr" : undefined}
                  title={file?.name}
                  className="max-w-xl truncate text-base font-semibold"
                >
                  {file?.name ?? "גררו לכאן קובץ PDF"}
                </span>
                <span
                  aria-live="polite"
                  className={cn(
                    "text-sm text-muted-foreground",
                    pdfInspection.status === "invalid" && "text-destructive"
                  )}
                >
                  {pdfInspection.status === "inspecting"
                    ? "בודקים את הקובץ…"
                    : pdfInspection.status === "valid"
                      ? `${formatPageCount(pdfInspection.pageCount)} · הקובץ מוכן`
                      : pdfInspection.status === "invalid"
                        ? pdfInspection.message
                        : "או לחצו כדי לבחור קובץ מהמחשב"}
                </span>
              </span>
              <span className="font-mono text-[0.7rem] tracking-wide text-muted-foreground">
                PDF · עד {maxPages} עמודים · עד{" "}
                {formatMegabytes(maxFileBytes)}MB
              </span>
            </label>
            <div className="flex justify-end">
              <Button
                type="button"
                size="lg"
                disabled={!isPdfValid}
                onClick={() => setActiveStep(2)}
                className="min-w-32"
              >
                המשך
                <ArrowLeft data-icon="inline-end" />
              </Button>
            </div>
          </CardContent>
        </FlowCard>

        <FlowCard
          step={2}
          activeStep={activeStep}
          title="מספר הפקס"
          summary={recipientSummary}
          icon={<Phone className="size-4" />}
          onOpen={setActiveStep}
        >
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
                  recipientError &&
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
                  aria-invalid={recipientError ? true : undefined}
                  value={recipient}
                  onChange={(event) => {
                    setRecipient(event.currentTarget.value)
                  }}
                  onBlur={() => setRecipientTouched(true)}
                  className="h-full border-0 bg-transparent px-0 text-end font-mono text-lg tracking-wide placeholder:text-muted-foreground/40 focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
                />
              </div>
              <p
                id="recipient-fax-help"
                aria-live="polite"
                className={cn(
                  "text-xs leading-relaxed text-muted-foreground",
                  recipientError && "text-destructive"
                )}
              >
                {recipientError ??
                  "אפשר להזין גם מספר ישראלי בפורמט בינלאומי."}
              </p>
            </div>

            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={() => setActiveStep(1)}
              >
                <ArrowRight data-icon="inline-start" />
                חזרה
              </Button>
              <Button
                type="button"
                size="lg"
                disabled={!isRecipientValid}
                onClick={() => setActiveStep(3)}
                className="min-w-32"
              >
                המשך
                <ArrowLeft data-icon="inline-end" />
              </Button>
            </div>
          </CardContent>
        </FlowCard>

        <FlowCard
          step={3}
          activeStep={activeStep}
          title="תשלום ושליחה"
          summary="₪9.90"
          icon={<CreditCard className="size-4" />}
          onOpen={setActiveStep}
        >
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
                onClick={() => setActiveStep(2)}
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
        </FlowCard>
      </div>
    </section>
  )
}

function formatPageCount(pageCount: number): string {
  return pageCount === 1 ? "עמוד אחד" : `${pageCount} עמודים`
}

function formatMegabytes(bytes: number): string {
  return Number.isInteger(bytes / 1024 / 1024)
    ? String(bytes / 1024 / 1024)
    : (bytes / 1024 / 1024).toFixed(1)
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
