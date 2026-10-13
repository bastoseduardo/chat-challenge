import { describe, it, expect } from "vitest"
import { QuotaError, getCaps } from "@/lib/usage/caps"

describe("QuotaError", () => {
  it("constrói com shape correto", () => {
    const err = new QuotaError("user", 1000, 500)
    expect(err).toBeInstanceOf(Error)
    expect(err.scope).toBe("user")
    expect(err.used).toBe(1000)
    expect(err.cap).toBe(500)
    expect(err.message).toContain("Quota exceeded")
  })

  it("aceita scope global", () => {
    const err = new QuotaError("global", 2000, 1000)
    expect(err.scope).toBe("global")
  })
})

describe("getCaps", () => {
  it("lê valores dos env vars", () => {
    const caps = getCaps()
    expect(typeof caps.userDaily).toBe("number")
    expect(typeof caps.globalDaily).toBe("number")
    expect(caps.userDaily).toBeGreaterThan(0)
    expect(caps.globalDaily).toBeGreaterThan(0)
  })

  it("usa fallback quando env é inválido", () => {
    const orig = process.env.USER_DAILY_TOKEN_CAP
    process.env.USER_DAILY_TOKEN_CAP = "não-é-número"
    const caps = getCaps()
    expect(caps.userDaily).toBe(100_000)
    process.env.USER_DAILY_TOKEN_CAP = orig
  })
})
