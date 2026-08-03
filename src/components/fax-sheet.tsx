"use client"

import { useState, type ReactNode } from "react"
import { CircleAlert, CreditCard, FileText, Phone } from "lucide-react"

import { DocumentStep } from "@/components/fax-flow/document-step"
import {
  FlowCard,
  type FaxStep,
} from "@/components/fax-flow/flow-card"
import {
  formatFaxQuote,
  PaymentStep,
} from "@/components/fax-flow/payment-step"
import { RecipientStep } from "@/components/fax-flow/recipient-step"
import { useDocumentUpload } from "@/components/fax-flow/use-document-upload"
import { useFaxSession } from "@/components/fax-flow/use-fax-session"
import { usePdfInspection } from "@/components/fax-flow/use-pdf-inspection"
import { useRecipientSave } from "@/components/fax-flow/use-recipient-save"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import type { FaxSessionData } from "@/shared/session/fax-session.types"

type FaxSheetProps = {
  maxFileBytes: number
  maxPages: number
}

/** Restores the browser session before mounting the interactive fax flow. */
export function FaxSheet(props: FaxSheetProps) {
  const faxSession = useFaxSession()

  if (faxSession.state.status === "loading") {
    return (
      <SessionStateCard>
        <Spinner className="size-7 text-brand" />
        <span>משחזרים את פרטי השליחה…</span>
      </SessionStateCard>
    )
  }

  if (faxSession.state.status === "error") {
    return (
      <SessionStateCard>
        <CircleAlert className="size-7 text-destructive" />
        <span>{faxSession.state.message}</span>
        <Button type="button" onClick={() => void faxSession.load()}>
          נסו שוב
        </Button>
      </SessionStateCard>
    )
  }

  return (
    <HydratedFaxFlow
      {...props}
      session={faxSession.state.session}
      onSessionChange={faxSession.update}
    />
  )
}

/** Coordinates local input with the authoritative Durable Object session. */
function HydratedFaxFlow({
  maxFileBytes,
  maxPages,
  session,
  onSessionChange,
}: FaxSheetProps & {
  session: FaxSessionData
  onSessionChange: (session: FaxSessionData) => void
}) {
  const [activeStep, setActiveStep] = useState<FaxStep>(() =>
    getRestoredStep(session)
  )
  const [recipient, setRecipient] = useState(
    session.document ? (session.recipient?.displayValue ?? "") : ""
  )
  const documentUpload = useDocumentUpload()
  const recipientSave = useRecipientSave()
  const { file, inspection, selectFile } = usePdfInspection({
    maxFileBytes,
    maxPages,
  })

  const storedDocument = file ? null : session.document
  const fileSummary =
    file?.name ?? session.document?.originalName ?? "מסמך PDF"
  const recipientSummary =
    session.recipient?.displayValue ??
    (recipient.trim() || "מספר הנמען")
  const pageCount = file
    ? inspection.status === "valid"
      ? inspection.pageCount
      : null
    : session.document?.pageCount ?? null

  function handleFileSelection(nextFile: File | null) {
    documentUpload.reset()
    selectFile(nextFile)
  }

  async function handleDocumentContinue() {
    if (!file) {
      if (session.document) {
        setActiveStep(2)
      }

      return
    }

    if (inspection.status !== "valid") {
      return
    }

    const isAlreadyStored =
      documentUpload.state.status === "ready" &&
      session.document?.originalName === file.name &&
      session.document.sizeBytes === file.size

    if (isAlreadyStored) {
      setActiveStep(2)
      return
    }

    const updatedSession = await documentUpload.upload(file)

    if (updatedSession) {
      onSessionChange(updatedSession)
      setActiveStep(2)
    }
  }

  function handleRecipientChange(nextRecipient: string) {
    recipientSave.reset()
    setRecipient(nextRecipient)
  }

  async function handleRecipientContinue() {
    const updatedSession = await recipientSave.save(recipient)

    if (updatedSession) {
      onSessionChange(updatedSession)
      setActiveStep(3)
    }
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
          <DocumentStep
            file={file}
            storedDocument={storedDocument}
            inspection={inspection}
            upload={documentUpload.state}
            maxFileBytes={maxFileBytes}
            maxPages={maxPages}
            onSelectFile={handleFileSelection}
            onContinue={handleDocumentContinue}
          />
        </FlowCard>

        <FlowCard
          step={2}
          activeStep={activeStep}
          title="מספר הפקס"
          summary={recipientSummary}
          icon={<Phone className="size-4" />}
          onOpen={setActiveStep}
        >
          <RecipientStep
            recipient={recipient}
            save={recipientSave.state}
            onRecipientChange={handleRecipientChange}
            onBack={() => setActiveStep(1)}
            onContinue={handleRecipientContinue}
          />
        </FlowCard>

        <FlowCard
          step={3}
          activeStep={activeStep}
          title="תשלום ושליחה"
          summary={formatFaxQuote(session.quote)}
          icon={<CreditCard className="size-4" />}
          onOpen={setActiveStep}
        >
          <PaymentStep
            fileSummary={session.document?.originalName ?? fileSummary}
            recipientSummary={
              session.recipient?.displayValue ?? recipientSummary
            }
            pageCount={session.document?.pageCount ?? pageCount}
            quote={session.quote}
            onBack={() => setActiveStep(2)}
          />
        </FlowCard>
      </div>
    </section>
  )
}

function getRestoredStep(session: FaxSessionData): FaxStep {
  if (session.document && session.recipient && session.quote) {
    return 3
  }

  return session.document ? 2 : 1
}

function SessionStateCard({ children }: { children: ReactNode }) {
  return (
    <section
      className="w-full max-w-6xl"
      aria-label="טעינת תהליך שליחת פקס"
    >
      <Card className="flex h-[31rem] items-center justify-center gap-4 text-muted-foreground lg:h-[27rem]">
        {children}
      </Card>
    </section>
  )
}
