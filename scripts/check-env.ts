/* eslint-disable @typescript-eslint/no-require-imports */
import "dotenv/config"

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

const missing = REQUIRED.filter((k) => !process.env[k])

if (missing.length > 0) {
  console.error("❌ Missing env vars:")
  for (const k of missing) console.error(`   - ${k}`)
  console.error("\nCopy .env.local.example to .env.local and fill in the values.")
  process.exit(1)
}

console.log(`✅ All ${REQUIRED.length} env vars present`)
