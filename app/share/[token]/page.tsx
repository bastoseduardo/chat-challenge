export const dynamic = "force-dynamic"

import { notFound } from "next/navigation"
import Link from "next/link"
import { MessageBubble } from "@/components/chat/message-bubble"
import { Markdown } from "@/components/chat/markdown"
import { PrintButton } from "@/components/share/print-button"
import { Button } from "@/components/ui/button"
import { loadSharedConversation } from "@/lib/db/queries/shared-conversation"
import { aggregateSources, sourceLabel } from "@/lib/sources/extract"

const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" })

/** Primeira frase do resumo, pra descrição do link (Open Graph). */
function firstSentence(summary: string | null | undefined): string | undefined {
  const text = summary?.split("\n")[0]?.trim()
  if (!text) return undefined
  const m = /^(.{20,220}?[.!?])(\s|$)/.exec(text)
  return (m?.[1] ?? text.slice(0, 200)).trim()
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const data = await loadSharedConversation(token)
  if (!data) return { title: "Relatório não encontrado" }
  const description = firstSentence(data.share?.summary) ?? "Relatório de pesquisa compartilhado, somente leitura"
  return {
    title: data.conversation.title,
    description,
    openGraph: { title: data.conversation.title, description, type: "article", siteName: "Seshat" },
    twitter: { card: "summary", title: data.conversation.title, description },
  }
}

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const data = await loadSharedConversation(token)
  if (!data) notFound()

  const { conversation, share, messages } = data
  const sources = aggregateSources(messages.filter((m) => m.role === "assistant"))
  const when = dateFmt.format(new Date(share?.created_at ?? conversation.created_at))

  return (
    <div className="report-shell flex h-dvh flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4 sm:px-6 print:hidden">
        <span aria-hidden className="h-5 w-0.5 rounded-full bg-tool" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">Seshat</span>
        <PrintButton />
        <Button asChild size="sm" className="shrink-0">
          <Link href="/login">Entrar para conversar</Link>
        </Button>
      </header>

      <main className="report-scroll flex-1 overflow-y-auto">
        <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          <header className="space-y-2 border-b pb-6">
            <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-balance">
              {conversation.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              Pesquisado com Seshat em {when}. Somente leitura.
            </p>
          </header>

          {share?.summary && (
            <section aria-labelledby="report-summary" className="report-summary mt-6 rounded-lg border-l-2 border-tool bg-card px-5 py-4">
              <h2 id="report-summary" className="mb-2 text-sm font-medium text-muted-foreground">
                Resumo
              </h2>
              <Markdown text={share.summary} reading />
            </section>
          )}

          <section aria-label="Conversa" className="mt-8 space-y-7">
            {conversation.compaction_count > 0 && (
              <p className="text-sm text-muted-foreground">
                As mensagens mais antigas desta conversa foram resumidas{" "}
                {conversation.compaction_count === 1 ? "uma vez" : `${conversation.compaction_count} vezes`}{" "}
                pra caber no contexto do modelo.
              </p>
            )}
            {messages.length === 0 && (
              <p className="py-16 text-center text-muted-foreground">Esta conversa está vazia.</p>
            )}
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
          </section>

          {sources.length > 0 && (
            <section aria-labelledby="report-sources" className="report-sources mt-12 border-t pt-6">
              <h2 id="report-sources" className="mb-3 font-semibold">
                Fontes consultadas
              </h2>
              <ul className="space-y-2 text-sm">
                {sources.map((s) => (
                  <li key={s.index} className="flex min-w-0 flex-col">
                    {s.url ? (
                      <a href={s.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                        {s.title}
                      </a>
                    ) : (
                      <span className="font-medium">{s.title}</span>
                    )}
                    <span className="truncate text-muted-foreground">{s.url ?? sourceLabel(s)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <footer className="mt-12 border-t pt-6 text-sm text-muted-foreground print:hidden">
            Relatório compartilhado em modo somente leitura. Pra fazer suas próprias perguntas,{" "}
            <Link href="/login" className="text-primary underline underline-offset-4">
              entre com sua conta
            </Link>
            .
          </footer>
        </article>
      </main>
    </div>
  )
}
