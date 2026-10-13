import { describe, it, expect } from "vitest"
import { detectKind, ATTACHMENT_LIMITS } from "@/lib/storage/attachments"

describe("detectKind", () => {
  it("reconhece imagens suportadas", () => {
    expect(detectKind("image/png")).toBe("image")
    expect(detectKind("image/jpeg")).toBe("image")
    expect(detectKind("image/webp")).toBe("image")
    expect(detectKind("image/gif")).toBe("image")
  })

  it("reconhece PDF", () => {
    expect(detectKind("application/pdf")).toBe("pdf")
  })

  it("rejeita tipos não suportados", () => {
    expect(detectKind("image/svg+xml")).toBeNull()
    expect(detectKind("text/plain")).toBeNull()
    expect(detectKind("application/zip")).toBeNull()
    expect(detectKind("")).toBeNull()
  })
})

describe("ATTACHMENT_LIMITS", () => {
  it("limita imagem a 10MB", () => {
    expect(ATTACHMENT_LIMITS.image.maxBytes).toBe(10 * 1024 * 1024)
  })

  it("limita PDF a 20MB", () => {
    expect(ATTACHMENT_LIMITS.pdf.maxBytes).toBe(20 * 1024 * 1024)
  })

  it("limita 5 anexos por mensagem", () => {
    expect(ATTACHMENT_LIMITS.maxPerMessage).toBe(5)
  })
})
