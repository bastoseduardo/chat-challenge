import type { UIMessage } from "ai"

const MAX_TOOL_OUTPUT_BYTES = 8 * 1024

/**
 * Remove partes e campos que só servem ao provider (ex.: `encryptedContent` dos
 * resultados da busca nativa, que é grande e opaco) e trunca saídas de
 * ferramenta acima de 8 KB antes de gravar `messages.content`. O texto citado
 * já fica preservado nas `citations` dos TextUIPart.
 */
export function compactPartsForStorage(parts: UIMessage["parts"]): UIMessage["parts"] {
  // Marcadores de início de etapa do provider (anthropic.message_start) não
  // têm uso na interface nem no relatório.
  return parts.filter((part) => part.type !== "custom").map((part) => {
    if (!("output" in part) || part.output === undefined) return part
    const stripped = stripKeys(part.output, "encryptedContent")
    const json = safeStringify(stripped)
    const output =
      json.length > MAX_TOOL_OUTPUT_BYTES
        ? { truncated: true, preview: json.slice(0, 2000) }
        : stripped
    return { ...part, output } as typeof part
  })
}

function stripKeys(value: unknown, key: string): unknown {
  if (Array.isArray(value)) return value.map((v) => stripKeys(v, key))
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([k]) => k !== key)
        .map(([k, v]) => [k, stripKeys(v, key)])
    )
  }
  return value
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? ""
  } catch {
    return String(value)
  }
}
