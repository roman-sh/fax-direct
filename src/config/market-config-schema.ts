import { z } from "zod"

export const marketConfigSchema = z
  .object({
    fax: z
      .object({
        maxPages: z.number().int().positive(),
        maxFileBytes: z.number().int().positive(),
      })
      .strict(),
    price: z
      .object({
        amount: z
          .string()
          .regex(/^(0|[1-9]\d*)\.\d{2}$/)
          .refine((value) => Number(value) > 0, {
            message: "Price must be greater than zero.",
          }),
        currency: z.literal("ILS"),
      })
      .strict(),
  })
  .strict()

export type MarketConfig = z.infer<typeof marketConfigSchema>
