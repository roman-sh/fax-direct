"use client"

import { CreditCard, FileText, Phone, Send } from "lucide-react"

import { PreviewCase, PreviewPage, useLocalStep } from "@/app/dev/_preview"
import { DocumentStep } from "@/components/fax-flow/document-step"
import { FlowCard, type FaxStep } from "@/components/fax-flow/flow-card"
import { PaymentStep } from "@/components/fax-flow/payment-step"
import { RecipientStep } from "@/components/fax-flow/recipient-step"

const DOCUMENT = {
  objectKey: "PREVIEW-CARD-DECK",
  originalName: "two_pages.pdf",
  pageCount: 2,
  sizeBytes: 399873,
}

const QUOTE = { amount: "9.90", currency: "ILS" } as const

/**
 * The three-card stack at each position in the flow. Every card is rendered,
 * so the collapsed strips can be judged alongside the open one — the part the
 * layout gets wrong when the breakpoint drops the stack entirely.
 */
export default function CardDeckPreview() {
  return (
    <PreviewPage
      title="Card stack"
      intro="The flow's three cards at each position, including the two resend states that are otherwise only reachable by paying for a fax and having it fail."
    >
      <PreviewCase
        label="step 1 — empty"
        note="Nothing chosen yet; both later cards are future states."
      >
        <Deck initialStep={1} hasDocument={false} hasRecipient={false} />
      </PreviewCase>

      <PreviewCase
        label="step 2 — document chosen"
        note="Card 1 collapses to its completed strip."
      >
        <Deck initialStep={2} hasDocument hasRecipient={false} />
      </PreviewCase>

      <PreviewCase
        label="step 3 — payment summary"
        note="Both inputs collapsed; the card asks for money."
      >
        <Deck initialStep={3} hasDocument hasRecipient />
      </PreviewCase>

      <PreviewCase
        label="step 3 — awaiting resend"
        note="Already paid, delivery cleared by an edit. Same summary, no price, sends instead of charging."
      >
        <Deck initialStep={3} hasDocument hasRecipient isResend />
      </PreviewCase>

      <PreviewCase
        label="step 3 — locked while sending"
        note="Cards 1 and 2 refuse to open while a paid fax is in flight."
      >
        <Deck initialStep={3} hasDocument hasRecipient locked />
      </PreviewCase>
    </PreviewPage>
  )
}

function Deck({
  initialStep,
  hasDocument,
  hasRecipient,
  isResend = false,
  locked = false,
}: {
  initialStep: FaxStep
  hasDocument: boolean
  hasRecipient: boolean
  isResend?: boolean
  locked?: boolean
}) {
  const [activeStep, setActiveStep] = useLocalStep(initialStep)

  return (
    <>
      <FlowCard
        step={1}
        activeStep={activeStep}
        title="המסמך לשליחה"
        summary={hasDocument ? DOCUMENT.originalName : "מסמך PDF"}
        icon={<FileText className="size-4" />}
        onOpen={setActiveStep}
        locked={locked}
      >
        <DocumentStep
          file={null}
          storedDocument={hasDocument ? DOCUMENT : null}
          inspection={{ status: "empty" }}
          upload={{ status: hasDocument ? "ready" : "idle" }}
          maxFileBytes={10 * 1024 * 1024}
          maxPages={10}
          onSelectFile={() => {}}
          onContinue={() => setActiveStep(2)}
        />
      </FlowCard>

      <FlowCard
        step={2}
        activeStep={activeStep}
        title="מספר הפקס"
        summary={hasRecipient ? "077-4448706" : "מספר הנמען"}
        icon={<Phone className="size-4" />}
        onOpen={setActiveStep}
        locked={locked}
      >
        <RecipientStep
          recipient={hasRecipient ? "077-4448706" : ""}
          save={{ status: "idle" }}
          onRecipientChange={() => {}}
          onBack={() => setActiveStep(1)}
          onContinue={() => setActiveStep(3)}
        />
      </FlowCard>

      <FlowCard
        step={3}
        activeStep={activeStep}
        title={isResend ? "שליחה חוזרת" : "תשלום ושליחה"}
        summary={isResend ? "מוכן לשליחה" : "₪9.90"}
        icon={
          isResend ? (
            <Send className="size-4" />
          ) : (
            <CreditCard className="size-4" />
          )
        }
        onOpen={setActiveStep}
      >
        <PaymentStep
          fileSummary={DOCUMENT.originalName}
          recipientSummary="077-4448706"
          pageCount={DOCUMENT.pageCount}
          payment={isResend ? { status: "paid" } : null}
          paymentStart={{ status: "idle" }}
          quote={QUOTE}
          isResend={isResend}
          isSending={false}
          sendError={null}
          onBack={() => setActiveStep(2)}
          onStartPayment={() => {}}
          onSend={() => {}}
        />
      </FlowCard>
    </>
  )
}
