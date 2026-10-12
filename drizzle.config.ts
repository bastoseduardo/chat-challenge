import "dotenv/config"
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DIRECT_URL!,
  },
  verbose: true,
  strict: true,
})
