import { z } from "zod"

/** Public operator details stored outside the repository in the legal KV entry. */
export const legalConfigSchema = z
  .object({
    operatorName: z.string().min(1),
    businessNumber: z.string().min(1),
    address: z.string().min(1),
  })
  .strict()

export type LegalConfig = z.infer<typeof legalConfigSchema>
