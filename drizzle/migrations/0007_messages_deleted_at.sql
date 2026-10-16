-- SPEC-R4-008: editar e reenviar apaga (soft delete) a mensagem editada e as
-- seguintes. Aditivo e idempotente.
-- Aplicar com: npx tsx scripts/apply-sql.ts drizzle/migrations/0007_messages_deleted_at.sql

ALTER TABLE "messages"
  ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz;
