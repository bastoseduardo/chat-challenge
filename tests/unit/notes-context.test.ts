import { describe, expect, it, vi } from "vitest"
import type { ModelMessage } from "ai"

const similarNotes = vi.fn()
const rerank = vi.fn()
vi.mock("@/lib/db/queries/notes", () => ({ similarNotes: (...a: unknown[]) => similarNotes(...a) }))
vi.mock("@/lib/ai/embeddings", () => ({ rerank: (...a: unknown[]) => rerank(...a) }))

const { findContextNotes, notesUsedData, withNotesContext } = await import("@/lib/notes/context")

const note = (id: string, content: string, extra: Record<string, unknown> = {}) =>
  ({
    id,
    content,
    title: null,
    quote: null,
    sourceUrl: null,
    sourceTitle: null,
    sourcePage: null,
    conversationId: null,
    messageId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    similarity: 0.5,
    ...extra,
  }) as never

describe("findContextNotes", () => {
  it("fica só com as notas que passam no rerank, da mais relevante pra menos", async () => {
    similarNotes.mockResolvedValueOnce([note("a", "RLS"), note("b", "bolo"), note("c", "Postgres 18")])
    rerank.mockResolvedValueOnce([0.42, 0.2, 0.81])
    const out = await findContextNotes("u1", "como proteger dados por usuário?")
    expect(out.map((n: { id: string }) => n.id)).toEqual(["c", "a"])
  })

  it("sem rerank, só passa nota muito parecida pelo cosseno", async () => {
    similarNotes.mockResolvedValueOnce([note("a", "x", { similarity: 0.7 }), note("b", "y", { similarity: 0.45 })])
    rerank.mockRejectedValueOnce(new Error("503"))
    const out = await findContextNotes("u1", "pergunta qualquer")
    expect(out.map((n: { id: string }) => n.id)).toEqual(["a"])
  })

  it("não consulta nada pra texto curto e devolve vazio se o embedding falhar", async () => {
    similarNotes.mockClear()
    expect(await findContextNotes("u1", "oi")).toEqual([])
    expect(similarNotes).not.toHaveBeenCalled()
    similarNotes.mockRejectedValueOnce(new Error("voyage"))
    expect(await findContextNotes("u1", "pergunta com texto")).toEqual([])
  })
})

describe("withNotesContext", () => {
  it("põe as notas na última mensagem do usuário, sem mexer no resto", () => {
    const history: ModelMessage[] = [
      { role: "user", content: "oi" },
      { role: "assistant", content: "olá" },
      { role: "user", content: "como proteger dados?" },
    ]
    const out = withNotesContext(history, [note("a", "Prefiro RLS", { sourceTitle: "Docs", sourcePage: 4 })])
    expect(out.slice(0, 2)).toEqual(history.slice(0, 2))
    const last = out[2] as { content: Array<{ type: string; text: string }> }
    expect(last.content[0].text).toContain("<user_notes>")
    expect(last.content[0].text).toContain("Prefiro RLS (fonte: Docs, p. 4)")
    expect(last.content[1]).toEqual({ type: "text", text: "como proteger dados?" })
  })

  it("sem notas devolve o histórico igual", () => {
    const history: ModelMessage[] = [{ role: "user", content: "x" }]
    expect(withNotesContext(history, [])).toBe(history)
  })
})

describe("notesUsedData", () => {
  it("usa o título ou a primeira linha do trecho/conteúdo", () => {
    const data = notesUsedData([note("a", "linha 1\nlinha 2"), note("b", "c", { title: "Título", quote: "trecho" })])
    expect(data.notes).toEqual([
      { id: "a", title: "linha 1", quote: null },
      { id: "b", title: "Título", quote: "trecho" },
    ])
  })
})
