-- RLS para rate_limit_buckets. Só service_role escreve/lê.
alter table public.rate_limit_buckets enable row level security;

-- Sem policy = nenhum role authenticated/anon acessa.
-- O lib/rate-limit.ts usa db conectado com DATABASE_URL (bypassa RLS por ser connection direto do postgres, não via PostgREST).
