import { describe, expect, it } from "vitest"
import type { UIMessage } from "ai"
import { compactPartsForStorage } from "@/lib/ai/persist-parts"

const parts = (p: unknown[]) => p as UIMessage["parts"]

describe("compactPartsForStorage", () => {
  it("remove partes custom e o encryptedContent dos resultados de busca", () => {
    const out = compactPartsForStorage(
      parts([
        { type: "custom", kind: "anthropic.message_start" },
        {
          type: "tool-web_search",
          toolCallId: "t1",
          state: "output-available",
          input: { query: "postgres" },
          output: [{ url: "https://a.com", title: "A", encryptedContent: "x".repeat(500) }],
        },
        { type: "text", text: "ok" },
      ])
    ) as unknown as Array<{ type: string; output?: unknown }>
    expect(out.map((p) => p.type)).toEqual(["tool-web_search", "text"])
    expect(out[0].output).toEqual([{ url: "https://a.com", title: "A" }])
  })

  it("trunca saída de ferramenta acima de 8 KB", () => {
    const [p] = compactPartsForStorage(
      parts([{ type: "dynamic-tool", toolName: "web_fetch", toolCallId: "t2", state: "output-available", input: {}, output: "y".repeat(20_000) }])
    ) as unknown as Array<{ output: { truncated: boolean; preview: string } }>
    expect(p.output.truncated).toBe(true)
    expect(p.output.preview.length).toBe(2000)
  })

  it("guarda só URL e título do resultado do web_fetch, mesmo com página grande", () => {
    const url = "https://www.postgresql.org/support/versioning/"
    const [p] = compactPartsForStorage(
      parts([
        {
          type: "tool-web_fetch",
          toolCallId: "t3",
          state: "output-available",
          input: { url },
          output: {
            type: "web_fetch_result",
            url,
            retrievedAt: "2026-10-16T10:00:00Z",
            content: { type: "document", title: "PostgreSQL: Versioning Policy", source: { type: "text", data: "z".repeat(50_000) } },
          },
        },
      ])
    ) as unknown as Array<{ output: unknown }>
    expect(p.output).toEqual({
      type: "web_fetch_result",
      url,
      retrievedAt: "2026-10-16T10:00:00Z",
      content: { type: "document", title: "PostgreSQL: Versioning Policy" },
    })
  })
})
