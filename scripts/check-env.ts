import { config } from "dotenv"
import { existsSync } from "node:fs"
import { resolve } from "node:path"

// Load .env.local first (Next.js convention), then fall back to .env
for (const file of [".env.local", ".env"]) {
  const path = resolve(process.cwd(), file)
  if (existsSync(path)) config({ path, override: false })
}

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "DIRECT_URL",
  "ANTHROPIC_API_KEY",
  "TAVILY_API_KEY",
  "USER_DAILY_TOKEN_CAP",
  "GLOBAL_DAILY_TOKEN_CAP",
  "MODEL_CONTEXT_WINDOW",
  "COMPACTION_THRESHOLD",
  "NEXT_PUBLIC_APP_URL",
  "ADMIN_EMAILS",
] as const

const OPTIONAL = ["VOYAGE_API_KEY", "CRON_SECRET", "AUDIT_RETENTION_DAYS"] as const

const PLACEHOLDER_PATTERNS = [/^placeholder$/i, /^sk-placeholder$/i, /^tvly-placeholder$/i, /PLACEHOLDER/]

const missing: string[] = []
const placeholder: string[] = []
const missingOptional: string[] = []

for (const key of REQUIRED) {
  const value = process.env[key]
  if (!value) {
    missing.push(key)
    continue
  }
  if (PLACEHOLDER_PATTERNS.some((re) => re.test(value))) {
    placeholder.push(key)
  }
}

for (const key of OPTIONAL) {
  if (!process.env[key]) missingOptional.push(key)
}

if (missing.length > 0) {
  console.error("❌ Missing env vars:")
  for (const k of missing) console.error(`   - ${k}`)
  console.error("\nCopy .env.local.example to .env.local and fill in the values.")
  process.exit(1)
}

if (placeholder.length > 0) {
  console.warn("⚠️  Env vars still have placeholder values:")
  for (const k of placeholder) console.warn(`   - ${k}`)
  console.warn("")
}

if (missingOptional.length > 0) {
  console.warn("ℹ️  Optional env vars not set (feature disabled):")
  for (const k of missingOptional) {
    const feature =
      k === "VOYAGE_API_KEY"
        ? "semantic search"
        : k === "CRON_SECRET"
          ? "audit retention cron"
          : "audit retention cron"
    console.warn(`   - ${k} → ${feature}`)
  }
  console.warn("")
}

console.log(`✅ All ${REQUIRED.length} required env vars present${placeholder.length ? " (with placeholders)" : ""}`)
