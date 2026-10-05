/**
 * Accepts one document for the current fax session.
 *
 * The route claims the session before touching its shared R2 object, stores the
 * original bytes, starts durable preparation, and returns the authoritative
 * `processing` session without waiting for document validation.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare"

import type { DocumentPreparationWorkflowParams } from "@/server/document/document-preparation.workflow"
import { getOrCreateFaxBrowserSession } from "@/server/session/fax-browser-session.service"
import type { FaxSessionDocumentFile } from "@/shared/session/fax-session.types"

export const runtime = "nodejs"

type ErrorCode =
  | "DOCUMENT_PROCESSING"
  | "DOCUMENT_UPLOAD_FAILED"
  | "FILE_REQUIRED"
  | "INVALID_REQUEST"

export async function POST(request: Request): Promise<Response> {
  let file: File

  // The route only verifies that multipart parsing produced a file. Content,
  // size, and page validation belong to the durable preparation Workflow.
  try {
    const formData = await request.formData()
    const uploadedFile = formData.get("file")

    if (!(uploadedFile instanceof File)) {
      return errorResponse("FILE_REQUIRED", "יש לבחור קובץ.", 400)
    }

    file = uploadedFile
  } catch {
    return errorResponse(
      "INVALID_REQUEST",
      "לא הצלחנו לקרוא את הקובץ שנשלח.",
      400
    )
  }

  let sessionId: string

  // The encrypted browser cookie identifies the Durable Object and R2 key.
  // A browser without a session receives a new one here.
  try {
    sessionId = (
      await getOrCreateFaxBrowserSession()
    ).sessionId
  } catch (error) {
    console.error("Could not identify fax session:", error)
    return errorResponse(
      "DOCUMENT_UPLOAD_FAILED",
      "לא הצלחנו לשמור את המסמך. נסו שוב.",
      503
    )
  }

  const document: FaxSessionDocumentFile = {
    objectKey: sessionId,
    originalName: file.name,
    sizeBytes: file.size,
  }
  const { env } = getCloudflareContext()
  const sessionObject = env.FAX_SESSIONS.getByName(sessionId)

  let processingSession

  // Record the accepted document as processing. The client will keep showing
  // this state while the file is stored and the preparation Workflow validates it.
  try {
    processingSession = await sessionObject.initializeDocument(document)
  } catch (error) {
    console.error("Could not initialize fax document:", error)
    return errorResponse(
      "DOCUMENT_UPLOAD_FAILED",
      "לא הצלחנו לשמור את המסמך. נסו שוב.",
      503
    )
  }

  if (!processingSession) {
    // `initializeDocument` returns null when another document is already being
    // processed for this session. Reject this upload until processing finishes.
    return errorResponse(
      "DOCUMENT_PROCESSING",
      "מסמך אחר כבר נמצא בעיבוד. המתינו לסיום העיבוד.",
      409
    )
  }

  try {
    // Store the original bytes in R2 under the session ID. The preparation
    // Workflow detects the real file type from those bytes.
    await env.FAX_DOCUMENTS.put(sessionId, file)

    // Start the document preparation Workflow after the file is stored in R2.
    // The Workflow uses the session ID to load and process the uploaded file.
    await env.DOCUMENT_PREPARATION_WORKFLOW.create({
      params: {
        sessionId,
      } satisfies DocumentPreparationWorkflowParams,
    })
  } catch (error) {
    console.error("Could not start document preparation:", error)

    // If the R2 upload or Workflow start fails, mark the document as failed so
    // the user can retry the upload.
    try {
      await sessionObject.failDocument("PROCESSING_FAILED")
    } catch (failureError) {
      console.error("Could not publish document preparation failure:", {
        sessionId,
        error:
          failureError instanceof Error
            ? failureError.message
            : String(failureError),
      })
    }

    return errorResponse(
      "DOCUMENT_UPLOAD_FAILED",
      "לא הצלחנו לשמור את המסמך. נסו שוב.",
      503
    )
  }

  // Tell the frontend that the upload was accepted and the document is being
  // prepared. The Workflow later publishes the final `ready` or `failed` state.
  return Response.json(processingSession, {
    status: 202,
    headers: {
      "Cache-Control": "no-store",
    },
  })
}

function errorResponse(
  code: ErrorCode,
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
