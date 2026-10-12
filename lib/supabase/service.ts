import { createClient } from "@supabase/supabase-js"

/**
 * Supabase client com service role — SOMENTE server-side.
 * Usar quando precisar bypassar RLS (ex.: inserir audit_events, usage_events, signed URLs).
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  )
}
