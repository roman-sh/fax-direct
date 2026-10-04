import type { DragEvent } from "react"
import {
  ArrowLeft,
  CircleAlert,
  ExternalLink,
  FileText,
  Upload,
} from "lucide-react"

import { CardHeading } from "@/components/fax-flow/flow-card"
import type { DocumentSelectionState } from "@/components/fax-flow/use-document-selection"
import type { DocumentUploadState } from "@/components/fax-flow/use-document-upload"
import { Button } from "@/components/ui/button"
import { CardContent } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { ACCEPTED_DOCUMENT_FORMATS } from "@/shared/document/document-formats"
import type { FaxSessionReadyDocument } from "@/shared/session/fax-session.types"

type DocumentStepProps = {
  file: File | null
  storedDocument: FaxSessionReadyDocument | null
  selection: DocumentSelectionState
  upload: DocumentUploadState
  maxFileBytes: number
  maxPages: number
  onSelectFile: (file: File | null) => void
  onContinue: () => void
}

export function DocumentStep({
  file,
  storedDocument,
  selection,
  upload,
  maxFileBytes,
  maxPages,
  onSelectFile,
  onContinue,
}: DocumentStepProps) {
  const hasStoredDocument = file === null && storedDocument !== null
  const isValid = selection.status === "valid" || hasStoredDocument
  const isUploading = upload.status === "uploading"
  const hasError =
    selection.status === "invalid" || upload.status === "error"
  const displayedName = file?.name ?? storedDocument?.originalName
  const statusMessage = getDocumentStatusMessage(
    selection,
    upload,
    hasStoredDocument ? storedDocument : null
  )

  function handleFileDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    onSelectFile(event.dataTransfer.files.item(0))
  }

  return (
    <>
      <CardHeading
        title="בחירת המסמך"
        description="בחרו את קובץ ה־PDF שתרצו לשלוח."
      />
      <CardContent className="flex min-h-0 flex-1 flex-col gap-5 p-7">
        <input
          id="fax-document"
          type="file"
          accept={ACCEPTED_DOCUMENT_FORMATS.map(
            (format) => `.${format}`
          ).join(",")}
          disabled={isUploading}
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
            hasError && "border-destructive/45 bg-destructive/5",
            isUploading && "pointer-events-none cursor-wait"
          )}
        >
          <span
            className={cn(
              "flex size-16 items-center justify-center rounded-2xl border border-border bg-card text-brand shadow-sm transition-transform group-hover:-translate-y-0.5",
              isValid && "text-success",
              hasError && "text-destructive"
            )}
          >
            {isUploading ? (
              <Spinner className="size-7" />
            ) : hasError ? (
              <CircleAlert className="size-7" />
            ) : displayedName ? (
              <FileText className="size-7" />
            ) : (
              <Upload className="size-7" />
            )}
          </span>
          <span className="flex max-w-full flex-col gap-1">
            <span
              dir={displayedName ? "ltr" : undefined}
              title={displayedName}
              className="max-w-xl truncate text-base font-semibold"
            >
              {displayedName ?? "גררו לכאן קובץ PDF"}
            </span>
            {statusMessage ? (
              <span
                aria-live="polite"
                className={cn(
                  "text-sm text-muted-foreground",
                  hasError && "text-destructive"
                )}
              >
                {statusMessage}
              </span>
            ) : null}
          </span>
          <span className="font-mono text-[0.7rem] tracking-wide text-muted-foreground">
            PDF · עד {maxPages} עמודים · עד {formatMegabytes(maxFileBytes)}MB
          </span>
        </label>
        <p className="text-center text-sm text-muted-foreground">
          צריכים לאחד תמונות או לסדר עמודים?{" "}
          <a
            href="https://simplepdf.com/editor"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:text-brand focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            הכינו את המסמך ב־<bdi dir="ltr">SimplePDF</bdi>
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        </p>
        <div className="flex justify-end">
          <Button
            type="button"
            size="lg"
            disabled={!isValid || isUploading}
            onClick={onContinue}
            className="min-w-32"
          >
            {isUploading ? (
              <>
                <Spinner data-icon="inline-start" />
                מעלים…
              </>
            ) : (
              <>
                המשך
                <ArrowLeft data-icon="inline-end" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </>
  )
}

function getDocumentStatusMessage(
  selection: DocumentSelectionState,
  upload: DocumentUploadState,
  storedDocument: FaxSessionReadyDocument | null
): string | null {
  if (upload.status === "uploading") {
    return "מעלים ושומרים את המסמך…"
  }

  if (upload.status === "error") {
    return upload.message
  }

  if (selection.status === "invalid") {
    return selection.message
  }

  if (storedDocument) {
    return `${formatPageCount(storedDocument.pageCount)} · המסמך השמור מוכן`
  }

  if (selection.status === "valid") {
    return null
  }

  return "או לחצו כדי לבחור קובץ מהמחשב"
}

function formatPageCount(pageCount: number): string {
  return pageCount === 1 ? "עמוד אחד" : `${pageCount} עמודים`
}

function formatMegabytes(bytes: number): string {
  return Number.isInteger(bytes / 1024 / 1024)
    ? String(bytes / 1024 / 1024)
    : (bytes / 1024 / 1024).toFixed(1)
}
