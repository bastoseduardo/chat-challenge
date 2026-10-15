"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/browser"
import { Markdown } from "@/components/chat/markdown"
import { ResearchTrail, type ToolStep } from "@/components/chat/research-trail"

// Prévia estática do produto: os mesmos componentes da conversa real.
const DEMO_STEPS: ToolStep[] = [
  {
    key: "1",
    toolName: "web_search",
    state: "output-available",
    input: { query: "versão estável PostgreSQL" },
  },
  {
    key: "2",
    toolName: "web_scrape",
    state: "output-available",
    input: { url: "https://www.postgresql.org/support/versioning/" },
  },
  { key: "3", toolName: "save_note", state: "output-available", input: {} },
]

const DEMO_ANSWER =
  "A versão estável mais recente é a **18**. Ela recebe correções até **novembro de 2030**, segundo a política de versões do projeto. Guardei isso nas suas notas."

export default function LoginPage() {
  const [loading, setLoading] = useState(false)

  async function signInWithGoogle() {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: "https://www.googleapis.com/auth/drive.readonly",
      },
    })
  }

  return (
    <main className="flex min-h-dvh items-center px-4 py-10 sm:px-8">
      <div className="mx-auto grid w-full max-w-5xl items-center gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <div className="max-w-md space-y-8">
          <div className="flex items-center gap-2.5">
            <span aria-hidden className="h-6 w-1 rounded-full bg-tool" />
            <span className="text-lg font-semibold">Chat Challenge</span>
          </div>

          <div className="space-y-3">
            <h1 className="text-[34px] font-semibold leading-[1.1] tracking-tight text-balance sm:text-[40px]">
              Respostas que mostram de onde vieram.
            </h1>
            <p className="text-[17px] text-muted-foreground">
              O assistente pesquisa na web, lê páginas, PDFs e imagens, consulta seu Drive e
              guarda notas. Cada passo fica visível na conversa.
            </p>
          </div>

          <div className="space-y-3">
            <Button className="h-11 w-full text-[15px]" onClick={signInWithGoogle} disabled={loading}>
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
              {loading ? "Abrindo o Google…" : "Continuar com Google"}
            </Button>
            {process.env.NODE_ENV === "development" && (
              <Button asChild variant="outline" className="h-11 w-full">
                {/* Só em dev: sessão real via /auth/dev-login (requer DEV_LOGIN_EMAIL). */}
                <a href="/auth/dev-login">Entrar sem Google (dev)</a>
              </Button>
            )}
            <p className="text-sm text-muted-foreground">
              Suas conversas ficam salvas e as ações são registradas em log de auditoria.
            </p>
          </div>
        </div>

        {/* inert: prévia ilustrativa, fora do foco e da leitura de tela */}
        <div
          inert
          className="select-none rounded-xl border bg-card p-5 shadow-xl shadow-black/10 sm:p-7"
        >
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-lg border bg-background px-4 py-2.5">
              Qual a versão estável mais recente do PostgreSQL? Salva nas minhas notas.
            </div>
          </div>
          <div className="mt-5">
            <ResearchTrail steps={DEMO_STEPS} live />
            <Markdown text={DEMO_ANSWER} reading />
          </div>
        </div>
      </div>
    </main>
  )
}
