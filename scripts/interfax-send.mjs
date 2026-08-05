import { appendFile, mkdir, readFile, stat, writeFile } from "node:fs/promises"
import { basename, extname, resolve } from "node:path"

const INTERFAX_BASE_URL = "https://rest.interfax.net"
const MAX_DIRECT_UPLOAD_BYTES = 8 * 1024 * 1024
const POLL_INTERVAL_MS = 10_000
const MAX_POLL_ATTEMPTS = 180

/**
 * Sends one real PDF fax through InterFAX and polls until InterFAX reports a
 * final delivery result. This intentionally uses only Node's built-in APIs so
 * it can also serve as a small, readable integration reference.
 */
async function main() {
  const [pdfArgument] = process.argv.slice(2)
  const faxNumber = process.env.INTERFAX_TEST_FAX_NUMBER
  const username = process.env.INTERFAX_USERNAME
  const password = process.env.INTERFAX_PASSWORD

  if (!pdfArgument) {
    throw new Error(
      "Usage: npm run interfax:test -- /absolute/path/document.pdf"
    )
  }

  if (!/^\+\d{7,15}$/.test(faxNumber)) {
    throw new Error("Use an international E.164 fax number, for example +972...")
  }

  const pdfPath = resolve(pdfArgument)
  const pdfStats = await stat(pdfPath)

  if (!pdfStats.isFile()) {
    throw new Error(`Not a file: ${pdfPath}`)
  }

  if (extname(pdfPath).toLowerCase() !== ".pdf") {
    throw new Error("The test document must be a PDF.")
  }

  if (pdfStats.size > MAX_DIRECT_UPLOAD_BYTES) {
    throw new Error(
      `The PDF is ${formatBytes(pdfStats.size)}. Direct InterFAX REST requests are limited to 8 MB.`
    )
  }

  const pdf = await readFile(pdfPath)

  if (pdf.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new Error("The selected file does not have a PDF header.")
  }

  const authorization = createBasicAuthorization(username, password)
  const reference = `fax-direct-test-${Date.now()}`
  const sendUrl = new URL("/outbound/faxes", INTERFAX_BASE_URL)
  sendUrl.searchParams.set("faxNumber", faxNumber)
  sendUrl.searchParams.set("reference", reference)
  sendUrl.searchParams.set("pageHeader", "N")

  console.log(`Sending ${basename(pdfPath)} (${formatBytes(pdf.length)}) to ${faxNumber}...`)

  const sendResponse = await fetch(sendUrl, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/pdf",
    },
    body: pdf,
  })

  if (sendResponse.status !== 201) {
    throw await createResponseError("InterFAX rejected the fax", sendResponse)
  }

  const location = sendResponse.headers.get("location")

  if (!location) {
    throw new Error("InterFAX returned 201 Created without a Location header.")
  }

  const transactionId = getLastPathSegment(location)
  const pollLogDirectory = resolve("tmp/interfax")
  const pollLogPath = resolve(pollLogDirectory, `${transactionId}.jsonl`)

  await mkdir(pollLogDirectory, { recursive: true })
  await writeFile(pollLogPath, "")

  console.log(`Accepted. Transaction ID: ${transactionId}`)
  console.log(`Reference: ${reference}`)
  console.log(`Polling log: ${pollLogPath}`)
  console.log("Waiting for the final delivery result...")

  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt += 1) {
    await delay(POLL_INTERVAL_MS)

    const fax = await getFaxRecord(transactionId, authorization)
    const status = Number(fax.status)

    await logPollResponse(pollLogPath, attempt, fax)
    printPollProgress(attempt, fax)

    if (!Number.isFinite(status)) {
      throw new Error(`InterFAX returned an invalid status: ${fax.status}`)
    }

    if (status < 0) {
      continue
    }

    printFinalResult(fax)

    if (status > 0) {
      process.exitCode = 2
    }

    return
  }

  throw new Error(
    "Stopped polling after 30 minutes. The fax may still be processing; query it using the transaction ID printed above."
  )
}

/** Retrieves InterFAX's authoritative record for one outbound fax. */
async function getFaxRecord(transactionId, authorization) {
  const response = await fetch(
    new URL(`/outbound/faxes/${encodeURIComponent(transactionId)}`, INTERFAX_BASE_URL),
    {
      headers: { Authorization: authorization },
    }
  )

  if (!response.ok) {
    throw await createResponseError("Could not retrieve fax status", response)
  }

  return response.json()
}

/** Saves the complete API response from every poll for later investigation. */
async function logPollResponse(logPath, pollNumber, fax) {
  const entry = {
    polledAt: new Date().toISOString(),
    pollNumber,
    response: fax,
  }

  await appendFile(logPath, `${JSON.stringify(entry)}\n`)
}

/** Prints the fields needed to observe whether pages advance during sending. */
function printPollProgress(pollNumber, fax) {
  console.log(
    `Poll ${pollNumber}: ${JSON.stringify({
      status: fax.status,
      pagesSubmitted: fax.pagesSubmitted,
      pagesSent: fax.pagesSent,
      attemptsMade: fax.attemptsMade,
      attemptsToPerform: fax.attemptsToPerform,
    })}`
  )
}

/** Prints fields that are useful when comparing our future session model. */
function printFinalResult(fax) {
  const delivered = Number(fax.status) === 0

  console.log(delivered ? "Fax delivered." : "Fax failed.")
  console.log(
    JSON.stringify(
      {
        status: fax.status,
        transactionId: fax.id,
        reference: fax.subject,
        pagesSubmitted: fax.pagesSubmitted,
        pagesSent: fax.pagesSent,
        attemptsMade: fax.attemptsMade,
        completionTime: fax.completionTime,
        remoteCSID: fax.remoteCSID,
        units: fax.units,
        costPerUnit: fax.costPerUnit,
        deleteAfterUsage: fax.deleteAfterUsage,
      },
      null,
      2
    )
  )
}

function createBasicAuthorization(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`
}

function getLastPathSegment(location) {
  const parts = new URL(location).pathname.split("/").filter(Boolean)
  const id = parts.at(-1)

  if (!id) {
    throw new Error(`Could not read a transaction ID from Location: ${location}`)
  }

  return id
}

async function createResponseError(message, response) {
  const responseBody = await response.text()
  const details = responseBody.trim() || response.statusText

  return new Error(`${message}: HTTP ${response.status} ${details}`)
}

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
