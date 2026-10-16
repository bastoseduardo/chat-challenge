-- SPEC-R4-006: caderno como contexto. Aditivo e idempotente.
-- Aplicar com: npx tsx scripts/apply-sql.ts drizzle/migrations/0006_notes_context.sql

ALTER TABLE "user_settings"
  ADD COLUMN IF NOT EXISTS "use_notes_context" boolean NOT NULL DEFAULT true;
