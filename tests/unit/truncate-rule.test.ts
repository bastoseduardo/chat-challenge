import { describe, expect, it } from "vitest"
import { truncateBlocked } from "@/lib/conversations/truncate-rule"

const t = (iso: string) => new Date(iso)

describe("truncateBlocked", () => {
  it("permite editar quando não há resumo", () => {
    expect(truncateBlocked(t("2026-10-16T10:00:00Z"), [])).toBe(false)
  })

  it("permite editar mensagem posterior ao último resumo", () => {
    expect(truncateBlocked(t("2026-10-16T10:05:00Z"), [t("2026-10-16T10:00:00Z")])).toBe(false)
  })

  it("bloqueia mensagem anterior a um resumo", () => {
    expect(truncateBlocked(t("2026-10-16T09:00:00Z"), [t("2026-10-16T08:00:00Z"), t("2026-10-16T10:00:00Z")])).toBe(true)
  })
})
