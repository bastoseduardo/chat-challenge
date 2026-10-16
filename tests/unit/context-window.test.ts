import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db/client", () => ({ db: {} }))
const { windowSince } = await import("@/lib/ai/context-window")

describe("windowSince", () => {
  it("sem resumo, começa do início", () => {
    expect(windowSince(null, null)).toBeNull()
  })

  it("com resumo, começa logo depois da última mensagem resumida", () => {
    expect(windowSince("2026-10-16 10:30:00.123456+00", "2026-10-16 10:00:00.654321+00")).toBe(
      "2026-10-16 10:00:00.654321+00"
    )
  })

  it("resumo antigo sem corte registrado cai na data do resumo", () => {
    expect(windowSince("2026-10-16 10:30:00.123456+00", null)).toBe("2026-10-16 10:30:00.123456+00")
  })
})
