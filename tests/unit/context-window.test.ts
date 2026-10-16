import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db/client", () => ({ db: {} }))
const { windowSince } = await import("@/lib/ai/context-window")

describe("windowSince", () => {
  it("sem resumo, começa do início", () => {
    expect(windowSince(null, null).getTime()).toBe(0)
  })

  it("com resumo, começa logo depois da última mensagem resumida", () => {
    const cutoff = new Date("2026-10-16T10:00:00Z")
    expect(windowSince(new Date("2026-10-16T10:30:00Z"), cutoff)).toBe(cutoff)
  })

  it("resumo antigo sem corte registrado cai na data do resumo", () => {
    const summary = new Date("2026-10-16T10:30:00Z")
    expect(windowSince(summary, null)).toBe(summary)
  })
})
