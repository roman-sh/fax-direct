"use client"

import { FileText, Phone, Send } from "lucide-react"

import { PreviewCase, PreviewPage, useLocalStep } from "@/app/dev/_preview"
import { DocumentStep } from "@/components/fax-flow/document-step"
import { FaxDeliveryStatusStep } from "@/components/fax-flow/fax-delivery-status-step"
import { FlowCard } from "@/components/fax-flow/flow-card"
import { RecipientStep } from "@/components/fax-flow/recipient-step"
import { FAX_STATUS } from "@/shared/session/fax-session-status"
import type {
  FaxFailureSemanticCode,
  FaxSessionFax,
} from "@/shared/session/fax-session.types"

/**
 * Every delivery state the status card can show, including failures that are
 * otherwise unreachable without a real fax going wrong in exactly that way.
 * The failure list covers the shapes that stress the layout: the shortest
 * message, the longest, both emphasis rules, and the two codes that offer no
 * emphasis at all.
 */
const DOCUMENT = {
  objectKey: "PREVIEW-DELIVERY",
  originalName: "two_pages.pdf",
  pageCount: 2,
  sizeBytes: 399873,
}

const PROGRESS_CASES: {
  label: string
  note: string
  fax: FaxSessionFax | null
}[] = [
  {
    label: "fax: null",
    note: "The 111ms after payment, before the Workflow claims an attempt.",
    fax: null,
  },
  {
    label: "preparing",
    note: "Reading the PDF and submitting it.",
    fax: fax(FAX_STATUS.PREPARING, 0, 2),
  },
  {
    label: "queued",
    note: "Accepted by the provider, not yet dialling.",
    fax: fax(FAX_STATUS.QUEUED, 0, 2),
  },
  {
    label: "sending — 0 of 2",
    note: "Connecting; the counter has nothing to show yet.",
    fax: fax(FAX_STATUS.SENDING, 0, 2),
  },
  {
    label: "sending — 1 of 2",
    note: "Mid-transmission, the bar half filled.",
    fax: fax(FAX_STATUS.SENDING, 1, 2),
  },
  {
    label: "finalizing — 2 of 2",
    note: "Every page sent, delivery still unconfirmed. Must not read as success.",
    fax: fax(FAX_STATUS.FINALIZING, 2, 2),
  },
  {
    label: "service_delayed",
    note: "A temporary provider hold; amber rather than red.",
    fax: fax(FAX_STATUS.SERVICE_DELAYED, 0, 2),
  },
  {
    label: "delivered",
    note: "The only state that means success.",
    fax: fax(FAX_STATUS.DELIVERED, 2, 2),
  },
]

const FAILURE_CASES: {
  code: FaxFailureSemanticCode
  note: string
  pagesSent: number
}[] = [
  {
    code: "CONNECTION_FAILED",
    note: "Retry leads, edit offered. The case a voice line actually produces.",
    pagesSent: 0,
  },
  {
    code: "VOICE_ANSWERED",
    note: "Edit leads: retrying calls the same person again.",
    pagesSent: 0,
  },
  {
    code: "DOCUMENT_PROCESSING_FAILED",
    note: "The only failure whose edit is the document.",
    pagesSent: 0,
  },
  {
    code: "BUSY",
    note: "Shortest message in the set.",
    pagesSent: 0,
  },
  {
    code: "PARTIAL_TRANSMISSION",
    note: "Longest message, nothing emphasized, and the page row stays.",
    pagesSent: 1,
  },
  {
    code: "DELIVERY_UNCONFIRMED",
    note: "Nothing emphasized: the recipient may already hold the document.",
    pagesSent: 2,
  },
]

export default function DeliveryPreview() {
  return (
    <PreviewPage
      title="Delivery status"
      intro="Every state of card 3 after payment. The failure examples are chosen to stress the heading, where the message and the buttons compete for one row."
    >
      {PROGRESS_CASES.map((example) => (
        <PreviewCase
          key={example.label}
          label={example.label}
          note={example.note}
        >
          <StatusCard fax={example.fax} />
        </PreviewCase>
      ))}

      {FAILURE_CASES.map((example) => (
        <PreviewCase
          key={example.code}
          label={`failed — ${example.code}`}
          note={example.note}
        >
          <StatusCard
            fax={{
              status: FAX_STATUS.FAILED,
              pagesSent: example.pagesSent,
              pagesSubmitted: 2,
              error: example.code,
            }}
          />
        </PreviewCase>
      ))}
    </PreviewPage>
  )
}

/**
 * The status card with the two collapsed strips beside it, exactly as the real
 * sheet renders it. Card 3 used to stand alone here, which made the open card
 * about 104px wider than it ever is in production at the same viewport — wide
 * enough to hide a heading that could not fit its own title, and the reason
 * that bug had to be found on the deployed site instead of on this page.
 */
function StatusCard({ fax }: { fax: FaxSessionFax | null }) {
  const [activeStep, setActiveStep] = useLocalStep(3)

  return (
    <>
      <FlowCard
        step={1}
        activeStep={activeStep}
        title="המסמך לשליחה"
        summary="two_pages.pdf"
        icon={<FileText className="size-4" />}
        onOpen={setActiveStep}
      >
        <DocumentStep
          file={null}
          storedDocument={DOCUMENT}
          inspection={{ status: "empty" }}
          upload={{ status: "ready" }}
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
        summary="077-4448706"
        icon={<Phone className="size-4" />}
        onOpen={setActiveStep}
      >
        <RecipientStep
          recipient="077-4448706"
          save={{ status: "idle" }}
          onRecipientChange={() => {}}
          onBack={() => setActiveStep(1)}
          onContinue={() => setActiveStep(3)}
        />
      </FlowCard>

      <FlowCard
        step={3}
        activeStep={activeStep}
        title="סטטוס השליחה"
        summary="סטטוס השליחה"
        icon={<Send className="size-4" />}
        onOpen={setActiveStep}
      >
        <FaxDeliveryStatusStep
          fax={fax}
          fileSummary="two_pages.pdf"
          recipientSummary="077-4448706"
          pageCount={2}
          locale="he-IL"
          retryState={{ status: "idle" }}
          onRetry={() => {}}
          onEditNumber={() => setActiveStep(2)}
          onEditDocument={() => setActiveStep(1)}
        />
      </FlowCard>
    </>
  )
}

function fax(
  status: FaxSessionFax["status"],
  pagesSent: number,
  pagesSubmitted: number
): FaxSessionFax {
  return { status, pagesSent, pagesSubmitted, error: null }
}
