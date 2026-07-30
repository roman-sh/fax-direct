import {
  getMarketConfig,
  MarketConfigError,
} from "@/server/config/get-market-config"
import {
  inspectPdfFile,
  PdfInspectionError,
  type PdfInspectionErrorCode,
} from "@/shared/pdf/inspect-pdf"

export const runtime = "nodejs"

type MarketConfig = Awaited<ReturnType<typeof getMarketConfig>>

type ErrorCode =
  | "CONFIG_UNAVAILABLE"
  | "FILE_REQUIRED"
  | "INVALID_REQUEST"
  | "INTERNAL_ERROR"

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

  let formData: FormData

  try {
    formData = await request.formData()
  } catch {
    return errorResponse(
      "INVALID_REQUEST",
      "לא הצלחנו לקרוא את הקובץ שנשלח.",
      400
    )
  }

  const file = formData.get("file")

  if (!(file instanceof File)) {
    return errorResponse("FILE_REQUIRED", "יש לבחור קובץ PDF.", 400)
  }

  try {
    const result = await inspectPdfFile(file, config.fax)

    return Response.json(
      {
        pageCount: result.pageCount,
        price: config.price,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    )
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
}

function errorResponse(
  code: ErrorCode | PdfInspectionError["code"],
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
