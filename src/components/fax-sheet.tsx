"use client"

import { useEffect, useState, type ReactNode } from "react"
import { CircleAlert, CreditCard, FileText, Phone, Send } from "lucide-react"

import { DocumentStep } from "@/components/fax-flow/document-step"
import { FaxDeliveryStatusStep } from "@/components/fax-flow/fax-delivery-status-step"
import type { FaxUiLocale } from "@/components/fax-flow/fax-status-messages"
import {
  FLOW_STACK_CLASS,
  FlowCard,
  type FaxStep,
} from "@/components/fax-flow/flow-card"
import {
  formatFaxQuote,
  PaymentStep,
} from "@/components/fax-flow/payment-step"
import { RecipientStep } from "@/components/fax-flow/recipient-step"
import { useDocumentUpload } from "@/components/fax-flow/use-document-upload"
import { useFaxRetry } from "@/components/fax-flow/use-fax-retry"
import { useFaxSession } from "@/components/fax-flow/use-fax-session"
import { usePdfInspection } from "@/components/fax-flow/use-pdf-inspection"
import { usePayment } from "@/components/fax-flow/use-payment"
import { useRecipientSave } from "@/components/fax-flow/use-recipient-save"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import {
  FAX_STATUS,
  PAYMENT_STATUS,
} from "@/shared/session/fax-session-status"
import type { FaxSessionData } from "@/shared/session/fax-session.types"

type FaxSheetProps = {
  locale: FaxUiLocale
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
  locale,
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
  // Checking `fax` as well keeps restoration resilient if the payment field
  // ever disagrees with an existing fax record.
  const isDeliveryPhase =
    session.payment?.status === PAYMENT_STATUS.PAID || session.fax !== null
  // A paid session with no delivery and a non-zero attempt count can only mean
  // the customer answered a failure by editing the document or the number,
  // which cleared it. The summary returns so they can review what changed and
  // send again; nothing is charged, because the session is already paid.
  const isAwaitingResend =
    session.payment?.status === PAYMENT_STATUS.PAID &&
    session.fax === null &&
    session.deliveryAttempt > 0
  // A final failure reopens editing: the customer may replace the document or
  // the fax number before retrying within the same paid session.
  const isDeliveryLocked =
    isDeliveryPhase && session.fax?.status !== FAX_STATUS.FAILED

  // While the paid fax may not be edited the flow snaps to the delivery-status
  // card and stays there. Keying on the lock also pulls a tab that was editing
  // after a failure back to card 3 when a retry starts elsewhere.
  useEffect(() => {
    if (isDeliveryLocked) {
      setActiveStep(3)
    }
  }, [isDeliveryLocked])
  const [recipient, setRecipient] = useState(
    session.document ? (session.recipient?.displayValue ?? "") : ""
  )
  const documentUpload = useDocumentUpload()
  const payment = usePayment()
  const recipientSave = useRecipientSave()
  const faxRetry = useFaxRetry()
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
    // Passing through this card is not an edit. Saving an unchanged number
    // would retire a failed delivery that the customer has not answered,
    // discarding the failure they came back to read.
    if (
      session.recipient &&
      recipient.trim() === session.recipient.displayValue
    ) {
      setActiveStep(3)
      return
    }

    const updatedSession = await recipientSave.save(recipient)

    if (updatedSession) {
      onSessionChange(updatedSession)
      setActiveStep(3)
    }
  }

  async function handleStartPayment() {
    const updatedSession = await payment.start()

    if (updatedSession) {
      onSessionChange(updatedSession)
    }
  }

  async function handleFaxRetry() {
    const updatedSession = await faxRetry.retry()

    if (updatedSession) {
      onSessionChange(updatedSession)
    }
  }

  return (
    <section
      className="w-full max-w-6xl"
      aria-label="תצוגת תהליך שליחת פקס"
    >
      <div className={FLOW_STACK_CLASS}>
        <FlowCard
          step={1}
          activeStep={activeStep}
          title="המסמך לשליחה"
          summary={fileSummary}
          icon={<FileText className="size-4" />}
          onOpen={setActiveStep}
          locked={isDeliveryLocked}
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
          locked={isDeliveryLocked}
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
          title={
            isDeliveryPhase && !isAwaitingResend
              ? "סטטוס השליחה"
              : isAwaitingResend
                ? "שליחה חוזרת"
                : "תשלום ושליחה"
          }
          summary={
            isDeliveryPhase && !isAwaitingResend
              ? "סטטוס השליחה"
              : isAwaitingResend
                ? "מוכן לשליחה"
                : formatFaxQuote(session.quote)
          }
          icon={
            isDeliveryPhase ? (
              <Send className="size-4" />
            ) : (
              <CreditCard className="size-4" />
            )
          }
          onOpen={setActiveStep}
        >
          {isDeliveryPhase && !isAwaitingResend ? (
            <FaxDeliveryStatusStep
              fax={session.fax}
              fileSummary={session.document?.originalName ?? fileSummary}
              recipientSummary={
                session.recipient?.displayValue ?? recipientSummary
              }
              pageCount={session.document?.pageCount ?? pageCount}
              locale={locale}
              retryState={faxRetry.state}
              onRetry={() => void handleFaxRetry()}
              onEditNumber={() => setActiveStep(2)}
              onEditDocument={() => setActiveStep(1)}
            />
          ) : (
            <PaymentStep
              fileSummary={session.document?.originalName ?? fileSummary}
              recipientSummary={
                session.recipient?.displayValue ?? recipientSummary
              }
              pageCount={session.document?.pageCount ?? pageCount}
              payment={session.payment}
              paymentStart={payment.state}
              quote={session.quote}
              isResend={isAwaitingResend}
              isSending={faxRetry.state.status === "starting"}
              sendError={
                faxRetry.state.status === "error"
                  ? faxRetry.state.message
                  : null
              }
              onBack={() => setActiveStep(2)}
              onStartPayment={handleStartPayment}
              onSend={() => void handleFaxRetry()}
            />
          )}
        </FlowCard>
      </div>
    </section>
  )
}

function getRestoredStep(session: FaxSessionData): FaxStep {
  if (
    session.payment?.status === PAYMENT_STATUS.PAID ||
    session.fax !== null
  ) {
    return 3
  }

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
      {/* Matching the stack's height keeps the page from resettling under the
          reader the moment the session arrives. */}
      <Card className="flex h-[37.5rem] items-center justify-center gap-4 text-muted-foreground min-[499px]:h-[31rem] lg:h-[27rem]">
        {children}
      </Card>
    </section>
  )
}
