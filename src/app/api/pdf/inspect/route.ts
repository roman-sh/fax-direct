import { getMarketConfig, MarketConfigError } from "@/config/get-market-config"
import { inspectPdf, PdfInspectionError } from "@/pdf/inspect-pdf"

export const runtime = "nodejs"

type MarketConfig = Awaited<ReturnType<typeof getMarketConfig>>

type ErrorCode =
  | "CONFIG_UNAVAILABLE"
  | "FILE_REQUIRED"
  | "FILE_TOO_LARGE"
  | "INVALID_FILE_TYPE"
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

  if (
    file.type &&
    file.type !== "application/pdf" &&
    file.type !== "application/x-pdf"
  ) {
    return errorResponse(
      "INVALID_FILE_TYPE",
      "ניתן להעלות קובצי PDF בלבד.",
      415
    )
  }

  if (file.size > config.fax.maxFileBytes) {
    return errorResponse(
      "FILE_TOO_LARGE",
      `גודל הקובץ המרבי הוא ${formatMegabytes(config.fax.maxFileBytes)}MB.`,
      413
    )
  }

  if (file.size === 0) {
    return errorResponse("INVALID_PDF", "קובץ ה-PDF ריק.", 422)
  }

  try {
    const result = await inspectPdf(
      new Uint8Array(await file.arrayBuffer()),
      config.fax.maxPages
    )

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
      return errorResponse(error.code, error.message, 422)
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

function formatMegabytes(bytes: number): string {
  return Number.isInteger(bytes / 1024 / 1024)
    ? String(bytes / 1024 / 1024)
    : (bytes / 1024 / 1024).toFixed(1)
}
