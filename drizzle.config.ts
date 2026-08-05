import { defineConfig } from "drizzle-kit"

export default defineConfig({
  dialect: "sqlite",
  out: "./drizzle/fax-session",
  schema: "./src/server/session/fax-session.schema.ts",
})
