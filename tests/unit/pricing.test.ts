import { describe, it, expect } from "vitest"
import { costUsd, PRICING, DEFAULT_MODEL } from "@/lib/ai/pricing"

describe("pricing.costUsd", () => {
  it("calcula custo correto pro Sonnet 4.6", () => {
    const cost = costUsd("claude-sonnet-4-6", 1_000_000, 1_000_000)
    expect(cost).toBeCloseTo(18, 2) // 3 + 15
  })

  it("calcula custo correto pro Opus 4.7", () => {
    const cost = costUsd("claude-opus-4-7", 100_000, 50_000)
    // 100k * 15 + 50k * 75 → (100*15 + 50*75) = 1500 + 3750 = 5250 / 1M = 0.00525
    expect(cost).toBeCloseTo(1.5 + 3.75, 4)
  })

  it("retorna 0 pra 0 tokens", () => {
    expect(costUsd("claude-sonnet-4-6", 0, 0)).toBe(0)
  })

  it("cai no default (Sonnet) pra modelo desconhecido", () => {
    const unknown = costUsd("unknown-model", 1_000_000, 0)
    const sonnet = costUsd("claude-sonnet-4-6", 1_000_000, 0)
    expect(unknown).toBe(sonnet)
  })

  it("PRICING tem todos os modelos esperados", () => {
    expect(PRICING).toHaveProperty("claude-sonnet-4-6")
    expect(PRICING).toHaveProperty("claude-opus-4-7")
  })

  it("DEFAULT_MODEL é claude-sonnet-4-6", () => {
    expect(DEFAULT_MODEL).toBe("claude-sonnet-4-6")
  })
})
