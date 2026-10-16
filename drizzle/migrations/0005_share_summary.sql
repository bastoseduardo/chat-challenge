-- SPEC-R4-007: resumo do relatório compartilhado. Aditivo e idempotente.
-- Aplicar com: npx tsx scripts/apply-sql.ts drizzle/migrations/0005_share_summary.sql

ALTER TABLE "shares"
  ADD COLUMN IF NOT EXISTS "summary" text,
  ADD COLUMN IF NOT EXISTS "summary_generated_at" timestamptz;
