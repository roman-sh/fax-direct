import type { Metadata } from "next"

import { PaymentReturn } from "@/app/payment/return/payment-return"

export const metadata: Metadata = {
  title: "מאשרים את התשלום | Fax Direct",
  robots: {
    index: false,
    follow: false,
  },
}

export default function PaymentReturnPage() {
  return <PaymentReturn />
}
