import type { DragEvent } from "react"
import { ArrowLeft, CircleAlert, FileText, Upload } from "lucide-react"

import { CardHeading } from "@/components/fax-flow/flow-card"
import type { PdfInspectionState } from "@/components/fax-flow/use-pdf-inspection"
import { Button } from "@/components/ui/button"
import { CardContent } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

type DocumentStepProps = {
  file: File | null
  inspection: PdfInspectionState
  maxFileBytes: number
  maxPages: number
  onSelectFile: (file: File | null) => void
  onContinue: () => void
}

export function DocumentStep({
  file,
  inspection,
  maxFileBytes,
  maxPages,
  onSelectFile,
  onContinue,
}: DocumentStepProps) {
  const isValid = inspection.status === "valid"

  function handleFileDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    onSelectFile(event.dataTransfer.files.item(0))
  }

  return (
    <>
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
            onSelectFile(event.currentTarget.files?.item(0) ?? null)
          }}
        />
        <label
          htmlFor="fax-document"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleFileDrop}
          className={cn(
            "group flex min-h-0 flex-1 cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-input bg-muted/65 p-6 text-center transition-colors",
            "hover:border-brand/60 hover:bg-brand-subtle/60 peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-ring/40",
            isValid && "border-success/45 bg-success-subtle/45",
            inspection.status === "invalid" &&
              "border-destructive/45 bg-destructive/5"
          )}
        >
          <span
            className={cn(
              "flex size-16 items-center justify-center rounded-2xl border border-border bg-card text-brand shadow-sm transition-transform group-hover:-translate-y-0.5",
              isValid && "text-success",
              inspection.status === "invalid" && "text-destructive"
            )}
          >
            {inspection.status === "inspecting" ? (
              <Spinner className="size-7" />
            ) : inspection.status === "invalid" ? (
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
                inspection.status === "invalid" && "text-destructive"
              )}
            >
              {inspection.status === "inspecting"
                ? "בודקים את הקובץ…"
                : inspection.status === "valid"
                  ? `${formatPageCount(inspection.pageCount)} · הקובץ מוכן`
                  : inspection.status === "invalid"
                    ? inspection.message
                    : "או לחצו כדי לבחור קובץ מהמחשב"}
            </span>
          </span>
          <span className="font-mono text-[0.7rem] tracking-wide text-muted-foreground">
            PDF · עד {maxPages} עמודים · עד {formatMegabytes(maxFileBytes)}MB
          </span>
        </label>
        <div className="flex justify-end">
          <Button
            type="button"
            size="lg"
            disabled={!isValid}
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

function formatPageCount(pageCount: number): string {
  return pageCount === 1 ? "עמוד אחד" : `${pageCount} עמודים`
}

function formatMegabytes(bytes: number): string {
  return Number.isInteger(bytes / 1024 / 1024)
    ? String(bytes / 1024 / 1024)
    : (bytes / 1024 / 1024).toFixed(1)
}
