import { describe, it, expect } from "vitest"
import { estimateTokens, estimateMessagesTokens } from "@/lib/ai/tokens"

describe("estimateTokens", () => {
  it("retorna 0 pra string vazia / null / undefined", () => {
    expect(estimateTokens("")).toBe(0)
    expect(estimateTokens(null)).toBe(0)
    expect(estimateTokens(undefined)).toBe(0)
  })

  it("aproxima 1 token por 4 chars", () => {
    expect(estimateTokens("abcd")).toBe(1)
    expect(estimateTokens("abcdefgh")).toBe(2)
  })

  it("arredonda pra cima", () => {
    expect(estimateTokens("abc")).toBe(1)
    expect(estimateTokens("a")).toBe(1)
  })
})

describe("estimateMessagesTokens", () => {
  it("soma tokens de várias mensagens com content string", () => {
    const result = estimateMessagesTokens([
      { content: "abcd" }, // 1
      { content: "efgh" }, // 1
    ])
    expect(result).toBe(2)
  })

  it("soma tokens de parts com type=text", () => {
    const result = estimateMessagesTokens([
      {
        parts: [
          { type: "text", text: "abcd" },
          { type: "text", text: "efgh" },
        ],
      },
    ])
    expect(result).toBe(2)
  })

  it("conta 1500 tokens por image/file part", () => {
    const result = estimateMessagesTokens([
      { parts: [{ type: "image" }, { type: "file" }] },
    ])
    expect(result).toBe(3000)
  })

  it("mistura text + image corretamente", () => {
    const result = estimateMessagesTokens([
      {
        parts: [
          { type: "text", text: "abcd" }, // 1
          { type: "image" }, // 1500
        ],
      },
    ])
    expect(result).toBe(1501)
  })

  it("ignora shapes vazios sem crashar", () => {
    expect(estimateMessagesTokens([])).toBe(0)
    expect(estimateMessagesTokens([{}])).toBe(0)
  })
})
