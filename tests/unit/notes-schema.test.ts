import { describe, expect, it } from "vitest"
import { createNoteSchema, listNotesQuerySchema, updateNoteSchema } from "@/lib/notes/schema"

const uuid = "8f524f70-3414-45e5-b3e6-b40a772857b1"

describe("createNoteSchema", () => {
  it("aceita nota só com trecho, com fonte e origem", () => {
    const r = createNoteSchema.safeParse({
      quote: "Versions 15, 16, 17 and 18 are supported until November 2030",
      source: { url: "https://www.postgresql.org/support/versioning/", title: "Versioning Policy" },
      conversationId: uuid,
      messageId: uuid,
    })
    expect(r.success).toBe(true)
  })

  it("aceita fonte de PDF com página", () => {
    expect(createNoteSchema.safeParse({ content: "d_model = 512", source: { title: "paper.pdf", page: 3 } }).success).toBe(true)
  })

  it("recusa nota sem conteúdo nem trecho", () => {
    const r = createNoteSchema.safeParse({ title: "Só título" })
    expect(r.success).toBe(false)
  })

  it("recusa conteúdo só com espaços", () => {
    expect(createNoteSchema.safeParse({ content: "   " }).success).toBe(false)
  })

  it("recusa URL de fonte inválida e ids que não são uuid", () => {
    expect(createNoteSchema.safeParse({ content: "x", source: { url: "não é url" } }).success).toBe(false)
    expect(createNoteSchema.safeParse({ content: "x", conversationId: "123" }).success).toBe(false)
  })
})

describe("updateNoteSchema", () => {
  it("aceita restaurar ou editar, recusa patch vazio", () => {
    expect(updateNoteSchema.safeParse({ restore: true }).success).toBe(true)
    expect(updateNoteSchema.safeParse({ content: "novo" }).success).toBe(true)
    expect(updateNoteSchema.safeParse({ title: null }).success).toBe(true)
    expect(updateNoteSchema.safeParse({}).success).toBe(false)
  })
})

describe("listNotesQuerySchema", () => {
  it("converte limit da query string e aplica padrão", () => {
    expect(listNotesQuerySchema.parse({}).limit).toBe(30)
    expect(listNotesQuerySchema.parse({ limit: "5" }).limit).toBe(5)
    expect(listNotesQuerySchema.safeParse({ limit: "500" }).success).toBe(false)
  })
})
