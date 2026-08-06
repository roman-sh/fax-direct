/**
 * Defines the InterFAX payloads accepted at the provider boundary. Runtime
 * validation keeps undocumented or malformed provider responses out of our
 * D1 and Durable Object models.
 */
import { z } from "zod"

/** The authoritative outbound-fax representation returned by InterFAX. */
export const interfaxFaxSchema = z.object({
  attemptsMade: z.number().int().nonnegative(),
  attemptsToPerform: z.number().int().nonnegative(),
  completionTime: z.string(),
  contact: z.string().nullable(),
  costPerUnit: z.number().nonnegative(),
  destinationFax: z.string(),
  duration: z.number().nonnegative(),
  id: z.number().int().nonnegative(),
  pageHeader: z.string().nullable(),
  pageOrientation: z.string(),
  pageResolution: z.string(),
  pageSize: z.string(),
  pagesSent: z.number().int().nonnegative(),
  pagesSubmitted: z.number().int().nonnegative(),
  priority: z.number().int(),
  remoteCSID: z.string().nullable(),
  rendering: z.string(),
  replyEmail: z.string(),
  senderCSID: z.string(),
  status: z.number().int(),
  subject: z.string(),
  submitTime: z.string(),
  units: z.number().nonnegative(),
  uri: z.string(),
  userId: z.string(),
})

/** A batch search returns the same fax records as the single-record endpoint. */
export const interfaxFaxBatchSchema = z.array(interfaxFaxSchema)

/** The documented JSON error body returned by InterFAX REST endpoints. */
export const interfaxErrorSchema = z.object({
  code: z.union([z.number(), z.string()]),
  message: z.string(),
  more_info: z.string().nullable().optional(),
})

export type InterfaxFax = z.infer<typeof interfaxFaxSchema>
export type InterfaxError = z.infer<typeof interfaxErrorSchema>
