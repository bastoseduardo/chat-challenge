import { describe, expect, it } from "vitest"
import { safeRedirect } from "@/lib/auth/safe-redirect"

const req = "http://localhost:3000/auth/dev-login"

describe("safeRedirect", () => {
  it("mantém caminhos do app", () => {
    expect(safeRedirect("/c/new?welcome=1", req).href).toBe("http://localhost:3000/c/new?welcome=1")
  })

  it.each(["//evil.com", "/\\evil.com","/\t/evil.com", "/\n/evil.com", "https://evil.com", "javascript:alert(1)"])(
    "recusa %j",
    (next) => {
      expect(safeRedirect(next, req).href).toBe("http://localhost:3000/")
    }
  )

  it("sem next vai pra raiz", () => {
    expect(safeRedirect(null, req).href).toBe("http://localhost:3000/")
  })
})
