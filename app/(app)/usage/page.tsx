export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { AppHeader } from "@/components/app-header"
import { createClient } from "@/lib/supabase/server"
import { sumTokensToday } from "@/lib/usage/counter"
import { getCaps } from "@/lib/usage/caps"
import { cn } from "@/lib/utils"

export const metadata = { title: "Uso de hoje" }

const WARN_AT = 80

export default async function UsagePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [userToday, caps] = await Promise.all([sumTokensToday(user.id), Promise.resolve(getCaps())])

  const totalTokens = userToday.input + userToday.output
  const pct = Math.min(100, Math.round((totalTokens / caps.userDaily) * 100))
  const remaining = Math.max(0, caps.userDaily - totalTokens)
  const fmt = (n: number) => n.toLocaleString("pt-BR")

  return (
    <>
      <AppHeader title={<h1 className="truncate px-1 font-semibold">Uso de hoje</h1>} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-10 px-4 py-8 sm:px-6">
          <section aria-labelledby="quota-heading" className="space-y-4">
            <h2 id="quota-heading" className="sr-only">
              Limite diário
            </h2>
            <p className="text-[26px] font-semibold leading-tight tracking-tight">
              <span className="tabular-nums">{fmt(totalTokens)}</span>
              <span className="text-muted-foreground font-normal">
                {" "}
                de {fmt(caps.userDaily)} tokens
              </span>
            </p>
            <div className="space-y-2">
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
                aria-label="Limite diário usado"
                className="relative h-2.5 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className={cn(
                    "h-full rounded-full transition-[width]",
                    pct >= 100 ? "bg-destructive" : pct >= WARN_AT ? "bg-warning" : "bg-primary"
                  )}
                  style={{ width: `${pct}%` }}
                />
                <div
                  aria-hidden
                  className="absolute inset-y-0 w-px bg-foreground/50"
                  style={{ left: `${WARN_AT}%` }}
                />
              </div>
              <div className="flex justify-between gap-4 text-sm text-muted-foreground">
                <span>
                  {pct >= 100
                    ? "Limite atingido. Novas mensagens ficam bloqueadas até o contador zerar."
                    : `${pct}% usado, restam ${fmt(remaining)} tokens`}
                </span>
                <span className="hidden shrink-0 sm:inline">Aviso em {WARN_AT}%</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              O contador zera todo dia à meia-noite, no horário do servidor.
            </p>
          </section>

          <section aria-labelledby="breakdown-heading" className="space-y-3">
            <h2 id="breakdown-heading" className="font-semibold">
              Detalhe
            </h2>
            <dl className="grid grid-cols-1 divide-y rounded-lg border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <div className="px-4 py-3">
                <dt className="text-sm text-muted-foreground">Tokens enviados</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums">{fmt(userToday.input)}</dd>
              </div>
              <div className="px-4 py-3">
                <dt className="text-sm text-muted-foreground">Tokens gerados</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums">{fmt(userToday.output)}</dd>
              </div>
              <div className="px-4 py-3">
                <dt className="text-sm text-muted-foreground">Custo estimado</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums">
                  {userToday.cost.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "USD",
                    minimumFractionDigits: 4,
                  })}
                </dd>
              </div>
            </dl>
            <p className="text-sm text-muted-foreground">
              Inclui respostas, títulos gerados e compactações de histórico.
            </p>
          </section>
        </div>
      </div>
    </>
  )
}
