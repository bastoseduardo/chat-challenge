import { describe, expect, it } from "vitest"
import { truncateBlocked } from "@/lib/conversations/truncate-rule"

const t = (iso: string) => new Date(iso)

describe("truncateBlocked", () => {
  it("permite editar quando não há resumo", () => {
    expect(truncateBlocked(t("2026-10-16T10:00:00Z"), [])).toBe(false)
  })

  it("permite editar mensagem recente que o resumo não cobre", () => {
    // corte às 9h; a mensagem é das 9h30, anterior à criação do resumo (10h)
    expect(truncateBlocked(t("2026-10-16T09:30:00Z"), [t("2026-10-16T09:00:00Z")])).toBe(false)
  })

  it("bloqueia a própria mensagem de corte e as anteriores", () => {
    expect(truncateBlocked(t("2026-10-16T09:00:00Z"), [t("2026-10-16T09:00:00Z")])).toBe(true)
    expect(truncateBlocked(t("2026-10-16T08:00:00Z"), [t("2026-10-16T09:00:00Z")])).toBe(true)
  })

  it("considera todos os resumos", () => {
    expect(truncateBlocked(t("2026-10-16T09:30:00Z"), [t("2026-10-16T08:00:00Z"), t("2026-10-16T10:00:00Z")])).toBe(true)
  })
})
