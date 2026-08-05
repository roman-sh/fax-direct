import { defineConfig } from "drizzle-kit"

/** Generates migrations for the global D1 database, separately from each DO. */
export default defineConfig({
  dialect: "sqlite",
  out: "./drizzle/d1",
  schema: "./src/server/fax/fax-transmission.schema.ts",
})
