"use client"

import { useState } from "react"
import { CreditCard, FileText, Phone } from "lucide-react"

import { DocumentStep } from "@/components/fax-flow/document-step"
import {
  FlowCard,
  type FaxStep,
} from "@/components/fax-flow/flow-card"
import { PaymentStep } from "@/components/fax-flow/payment-step"
import { RecipientStep } from "@/components/fax-flow/recipient-step"
import { useDocumentUpload } from "@/components/fax-flow/use-document-upload"
import { useFaxSession } from "@/components/fax-flow/use-fax-session"
import { usePdfInspection } from "@/components/fax-flow/use-pdf-inspection"

/** Coordinates shared state and navigation between the three fax-flow cards. */
export function FaxSheet({
  maxFileBytes,
  maxPages,
}: {
  maxFileBytes: number
  maxPages: number
}) {
  const [activeStep, setActiveStep] = useState<FaxStep>(1)
  const [recipient, setRecipient] = useState("")
  const documentUpload = useDocumentUpload()
  const { file, inspection, selectFile } = usePdfInspection({
    maxFileBytes,
    maxPages,
  })

  useFaxSession()

  const fileSummary = file?.name ?? "document.pdf"
  const recipientSummary = recipient.trim() || "מספר הנמען"
  const pageCount =
    inspection.status === "valid" ? inspection.pageCount : null

  function handleFileSelection(nextFile: File | null) {
    documentUpload.reset()
    selectFile(nextFile)
  }

  async function handleDocumentContinue() {
    if (!file || inspection.status !== "valid") {
      return
    }

    if (await documentUpload.upload(file)) {
      setActiveStep(2)
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
            onRecipientChange={setRecipient}
            onBack={() => setActiveStep(1)}
            onContinue={() => setActiveStep(3)}
          />
        </FlowCard>

        <FlowCard
          step={3}
          activeStep={activeStep}
          title="תשלום ושליחה"
          summary="₪9.90"
          icon={<CreditCard className="size-4" />}
          onOpen={setActiveStep}
        >
          <PaymentStep
            fileSummary={fileSummary}
            recipientSummary={recipientSummary}
            pageCount={pageCount}
            onBack={() => setActiveStep(2)}
          />
        </FlowCard>
      </div>
    </section>
  )
}
