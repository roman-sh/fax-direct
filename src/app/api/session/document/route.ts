/**
 * Validates and stores the PDF selected for the current fax session.
 *
 * The browser performs the same inspection first for immediate feedback, but
 * this route is authoritative. It loads the current market limits, validates
 * and counts the uploaded PDF, stores its bytes in R2 under the session code,
 * then records the document details in the session's Durable Object.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare"

import {
  getMarketConfig,
  MarketConfigError,
} from "@/server/config/market-config.service"
import { calculateFaxQuote } from "@/server/quote/quote.service"
import { getOrCreateFaxBrowserSession } from "@/server/session/fax-browser-session.service"
import {
  inspectPdfFile,
  PdfInspectionError,
  type PdfInspectionErrorCode,
} from "@/shared/pdf/inspect-pdf"
import type { FaxSessionDocument } from "@/shared/session/fax-session.types"

export const runtime = "nodejs"

type MarketConfig = Awaited<ReturnType<typeof getMarketConfig>>

type ErrorCode =
  | "CONFIG_UNAVAILABLE"
  | "FILE_REQUIRED"
  | "INTERNAL_ERROR"
  | "INVALID_REQUEST"
  | "SESSION_UNAVAILABLE"
  | "STORAGE_UNAVAILABLE"

export async function POST(request: Request): Promise<Response> {
  let config: MarketConfig

  try {
    config = await getMarketConfig("IL")
  } catch (error) {
    if (error instanceof MarketConfigError) {
      return errorResponse(
        "CONFIG_UNAVAILABLE",
        "השירות אינו זמין כרגע. נסו שוב מאוחר יותר.",
        503
      )
    }

    throw error
  }

  let file: File

  try {
    const formData = await request.formData()
    const uploadedFile = formData.get("file")

    if (!(uploadedFile instanceof File)) {
      return errorResponse("FILE_REQUIRED", "יש לבחור קובץ PDF.", 400)
    }

    file = uploadedFile
  } catch {
    return errorResponse(
      "INVALID_REQUEST",
      "לא הצלחנו לקרוא את הקובץ שנשלח.",
      400
    )
  }

  let pageCount: number

  try {
    pageCount = (await inspectPdfFile(file, config.fax)).pageCount
  } catch (error) {
    if (error instanceof PdfInspectionError) {
      return errorResponse(
        error.code,
        error.message,
        pdfInspectionStatus(error.code)
      )
    }

    console.error("Unexpected PDF inspection error:", error)
    return errorResponse(
      "INTERNAL_ERROR",
      "לא הצלחנו לבדוק את הקובץ. נסו שוב.",
      500
    )
  }

  let sessionId: string

  try {
    sessionId = (
      await getOrCreateFaxBrowserSession()
    ).sessionId
  } catch (error) {
    console.error("Could not identify fax session:", error)
    return errorResponse(
      "SESSION_UNAVAILABLE",
      "לא הצלחנו לשמור את המסמך. נסו שוב.",
      503
    )
  }

  const document: FaxSessionDocument = {
    objectKey: sessionId,
    originalName: file.name,
    pageCount,
    sizeBytes: file.size,
  }

  const { env } = getCloudflareContext()

  try {
    await env.FAX_DOCUMENTS.put(sessionId, file, {
      httpMetadata: {
        contentType: "application/pdf",
      },
    })
  } catch (error) {
    console.error("Could not store fax document in R2:", error)
    return errorResponse(
      "STORAGE_UNAVAILABLE",
      "לא הצלחנו לשמור את המסמך. נסו שוב.",
      503
    )
  }

  try {
    const session = await env.FAX_SESSIONS
      .getByName(sessionId)
      .setDocument(document, calculateFaxQuote(config))

    return Response.json(session, {
      headers: {
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("Could not update fax session document:", error)
    return errorResponse(
      "SESSION_UNAVAILABLE",
      "המסמך נשמר, אך לא הצלחנו לעדכן את השליחה. נסו שוב.",
      503
    )
  }
}

function errorResponse(
  code: ErrorCode | PdfInspectionErrorCode,
  message: string,
  status: number
): Response {
  return Response.json(
    { code, message },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  )
}

function pdfInspectionStatus(code: PdfInspectionErrorCode): number {
  if (code === "FILE_TOO_LARGE") {
    return 413
  }

  if (code === "INVALID_FILE_TYPE") {
    return 415
  }

  return 422
}
