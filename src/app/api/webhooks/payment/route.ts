/** Receives PayMe's asynchronous sale callbacks. */
import { payMeWebhookSchema } from "@/server/payment/payme-webhook.schema"
import { signalPaymentReconciliation } from "@/server/payment/payment.service"

export const runtime = "nodejs"

export async function POST(request: Request): Promise<Response> {
  let formData: FormData

  try {
    formData = await request.formData()
  } catch {
    return errorResponse("INVALID_REQUEST", "Invalid form body.", 400)
  }

  const callback = payMeWebhookSchema.safeParse(Object.fromEntries(formData))

  if (!callback.success) {
    return errorResponse("INVALID_CALLBACK", "Invalid PayMe callback.", 400)
  }

  switch (callback.data.type) {
    case "sale-complete":
    case "sale-failure":
      try {
        await signalPaymentReconciliation(callback.data.sessionId)
        return new Response(null, { status: 200 })
      } catch (error) {
        console.error("Could not signal payment reconciliation:", error)
        return errorResponse(
          "PAYMENT_RECONCILIATION_SIGNAL_FAILED",
          "Could not signal payment reconciliation.",
          503
        )
      }

    default:
      console.info(
        "Ignoring unsupported PayMe notification:",
        callback.data.notifyType
      )
      return new Response(null, { status: 200 })
  }
}

function errorResponse(
  code: string,
  message: string,
  status: number
): Response {
  return Response.json({ code, message }, { status })
}
