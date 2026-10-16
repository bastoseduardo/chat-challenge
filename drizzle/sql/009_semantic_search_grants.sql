-- Segurança: semantic_search_messages é SECURITY DEFINER e filtra pelo
-- p_user_id recebido. Com EXECUTE para anon/authenticated, qualquer um com a
-- chave pública do Supabase lia mensagens de outro usuário. O app só chama a
-- função pelo servidor (service_role), então só ele mantém o acesso.
-- Idempotente. Aplicar com: npx tsx scripts/apply-sql.ts drizzle/sql/009_semantic_search_grants.sql

REVOKE ALL ON FUNCTION public.semantic_search_messages(uuid, vector, int) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.semantic_search_messages(uuid, vector, int) TO service_role;
