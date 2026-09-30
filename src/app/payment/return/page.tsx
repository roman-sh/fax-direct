import type { Metadata } from "next"

import { PaymentReturn } from "@/app/payment/return/payment-return"
import { signalPaymentReconciliation } from "@/server/payment/payment.service"
import { getExistingFaxBrowserSessionId } from "@/server/session/fax-browser-session.service"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "מאשרים את התשלום | Fax Direct",
  robots: {
    index: false,
    follow: false,
  },
}

export default async function PaymentReturnPage() {
  const sessionId = await getExistingFaxBrowserSessionId()

  if (sessionId) {
    try {
      // The browser return is an early wake-up signal only. The Workflow still
      // queries PayMe before accepting the payment result.
      await signalPaymentReconciliation(sessionId)
    } catch (error) {
      // Do not strand the customer on an error page: the reconciliation
      // Workflow's one-minute provider check remains the fallback.
      console.error("Could not signal payment reconciliation from return:", error)
    }
  }

  return <PaymentReturn />
}
