-- SPEC-R4-008: semantic_search_messages v2. Mesma assinatura e grants da v1
-- (migração 0003), mais o filtro de mensagens apagadas (messages.deleted_at).
-- Aplicar depois da 0007: npx tsx scripts/apply-sql.ts drizzle/sql/008_semantic_search_v2.sql

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
    AND m.deleted_at IS NULL
  ORDER BY m.embedding <=> p_query_embedding
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION semantic_search_messages(uuid, vector, int) FROM public;
GRANT EXECUTE ON FUNCTION semantic_search_messages(uuid, vector, int) TO authenticated, service_role;
