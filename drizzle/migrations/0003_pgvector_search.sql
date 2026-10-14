-- Habilita extensão pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Coluna de embedding (Voyage voyage-3-lite retorna dim 512)
ALTER TABLE "messages"
  ADD COLUMN IF NOT EXISTS "embedding" vector(512);

-- Índice aproximado (HNSW é mais rápido pra queries ad-hoc)
CREATE INDEX IF NOT EXISTS "messages_embedding_hnsw_idx"
  ON "messages"
  USING hnsw ("embedding" vector_cosine_ops);

-- Função pra busca semântica cross-conversation do usuário.
-- SECURITY DEFINER mas filtra pelo userId passado + join com conversations do usuário.
CREATE OR REPLACE FUNCTION semantic_search_messages(
  p_user_id uuid,
  p_query_embedding vector(512),
  p_limit int DEFAULT 10
)
RETURNS TABLE (
  message_id uuid,
  conversation_id uuid,
  conversation_title text,
  role text,
  content jsonb,
  created_at timestamptz,
  similarity float
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.id AS message_id,
    c.id AS conversation_id,
    c.title AS conversation_title,
    m.role,
    m.content,
    m.created_at,
    1 - (m.embedding <=> p_query_embedding) AS similarity
  FROM messages m
  JOIN conversations c ON c.id = m.conversation_id
  WHERE c.user_id = p_user_id
    AND c.deleted_at IS NULL
    AND m.embedding IS NOT NULL
    AND m.is_summary = false
  ORDER BY m.embedding <=> p_query_embedding
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION semantic_search_messages(uuid, vector, int) FROM public;
GRANT EXECUTE ON FUNCTION semantic_search_messages(uuid, vector, int) TO authenticated, service_role;
