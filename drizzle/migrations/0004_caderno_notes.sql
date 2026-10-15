-- SPEC-R4-004: Caderno. Aditivo e idempotente (banco compartilhado com produção).
-- Aplicar com: npx tsx scripts/apply-sql.ts drizzle/migrations/0004_caderno_notes.sql

ALTER TABLE "user_notes"
  ADD COLUMN IF NOT EXISTS "title" text,
  ADD COLUMN IF NOT EXISTS "quote" text,
  ADD COLUMN IF NOT EXISTS "source_url" text,
  ADD COLUMN IF NOT EXISTS "source_title" text,
  ADD COLUMN IF NOT EXISTS "source_page" integer,
  ADD COLUMN IF NOT EXISTS "conversation_id" uuid REFERENCES "conversations"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "message_id" uuid REFERENCES "messages"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "embedding" vector(512),
  ADD COLUMN IF NOT EXISTS "updated_at" timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz;

CREATE INDEX IF NOT EXISTS "user_notes_user_created_idx"
  ON "user_notes" ("user_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "user_notes_embedding_hnsw_idx"
  ON "user_notes"
  USING hnsw ("embedding" vector_cosine_ops);
