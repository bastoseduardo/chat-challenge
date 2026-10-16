import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

/**
 * Login de desenvolvimento, sem Google: gera um magic link via service role
 * para DEV_LOGIN_EMAIL e troca na hora por uma sessão real do Supabase.
 * Só existe com NODE_ENV=development E DEV_LOGIN_EMAIL definido; em qualquer
 * outro caso responde 404. A sessão não traz provider_token, então as tools
 * do Google Drive ficam indisponíveis nesse modo.
 */
export async function GET(request: NextRequest) {
  const email = process.env.DEV_LOGIN_EMAIL
  if (process.env.NODE_ENV !== "development" || !email) {
    return new NextResponse(null, { status: 404 })
  }

  const admin = createServiceClient()
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email })
  const tokenHash = data?.properties?.hashed_token
  if (error || !tokenHash) {
    return NextResponse.json(
      { error: error?.message ?? "Não foi possível gerar o link de login" },
      { status: 500 }
    )
  }

  const supabase = await createClient()
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "email",
    token_hash: tokenHash,
  })
  if (verifyError) {
    return NextResponse.json({ error: verifyError.message }, { status: 500 })
  }

  // Só caminhos do próprio app: "//host" e "/\host" seriam outro domínio.
  const next = request.nextUrl.searchParams.get("next") ?? "/"
  const safe = next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/"
  return NextResponse.redirect(new URL(safe, request.url))
}
