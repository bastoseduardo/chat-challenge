# Decisão: como implementar as citações (SPEC-R4-002)

**Data:** 2026-10-15 · **Decisão:** **A**, com as ferramentas nativas **básicas** da Anthropic (`webSearch_20250305` + `webFetch_20250910`) · **Script:** `scripts/spike-citations.ts`

## O que foi medido

Modelo `claude-sonnet-4-6` (padrão do app), `streamText` + `toUIMessageStream({ sendSources: true })`.

| Caminho | Citações por trecho | Tempo | Tokens in/out | Custo aprox.* | Ruído na trilha |
|---|---|---|---|---|---|
| Nativa `webSearch_20260209` + `webFetch_20260209` | sim | 20–37 s | 19–37k / 0,5–1k | US$ 0,08–0,13 | **sim**: chamadas `code_execution` (filtro dinâmico) viram partes de ferramenta |
| **Nativa básica `webSearch_20250305` + `webFetch_20250910`** | **sim** | **8–9 s** | **14k / 0,3k** | **~US$ 0,05** | não |
| Tavily + Jina (atual) | não | 9 s | 2,8k / 0,3k | ~US$ 0,01 | não |
| PDF (arXiv 1706.03762, 15 p.) com `citations.enabled` | sim, com página | 7 s | 41k / 0,2k | ~US$ 0,12 | — |

\* Sonnet 4.6 a US$ 3/M entrada e 15/M saída, mais US$ 10 por mil buscas.

## O que o stream entrega (o achado principal)

Sequência observada (busca básica, pergunta sobre PostgreSQL):

```
U(web_search:{"query":"PostgreSQL latest stable version ..."}) R S S S S S S S S S T C1 T T C1 T T C1 T T C1
```

- `S` logo após a busca são **todos os resultados** da busca (`source-url`), **não** as citações. Servem pra trilha ("leu 9 resultados"), não pras marcações.
- `C1` é a citação **anexada ao bloco de texto** que ela sustenta. O provider emite no `text-end` (`providerMetadata.anthropic.citations`), e o AI SDK 7 grava no próprio `TextUIPart` como **`citations: Array<{ source, citedText }>`** (`node_modules/ai/dist/index.js`, `case "text-end"`). Isso vale pra web e pra PDF.
- Formato normalizado de cada citação:
  ```ts
  { citedText: string,
    source: { type: "source", sourceType: "url", url, title, providerMetadata: { anthropic: { ...original } } }
         | { type: "source", sourceType: "document", title, mediaType, filename?, providerMetadata: { anthropic: { start_page_number, end_page_number, cited_text, ... } } } }
  ```
- PDF: além do `citations` no texto, o provider emite `source-document` intercalado (`T T S C1 T T S C1`), com `providerMetadata.anthropic.{ citedText, startPageNumber, endPageNumber }`. Exemplo real: "dmodel = 512", **p. 3**.

Ou seja: **a ligação trecho ↔ fonte vem pronta**, sem marcador `[n]` gerado pelo modelo nem parser nosso.

## Por que A (básica) e não B

- Critérios da spec: intercalado **sim** (por bloco de texto), ferramentas legíveis na trilha **sim** (`web_search` com `query`, `web_fetch` com `url`), custo **~US$ 0,05**, na margem do limite. Com volume de portfólio, a diferença é de centavos.
- A versão `20260209` foi descartada: mais lenta, mais cara e polui a trilha com `code_execution`.
- B (Tavily + `[n]`) exigiria o modelo emitir marcadores de forma confiável e um parser no servidor; mais frágil e sem trecho citado exato.

## Custos e mitigação

- 5x mais tokens de entrada que o Tavily, porque os resultados da busca entram no contexto.
- `maxUses: 3` na busca e `maxUses: 2` na leitura. Leitura só quando a busca não basta (instrução de sistema).
- Tavily e Jina continuam no código, desligados, como plano de volta.

## Impacto nas specs

- **SPEC-R4-000 §2:** `extractSources` e `citationsByPart` leem `TextUIPart.citations` (web e PDF) e, como complemento, partes `source-document`. Partes `source-url` vindas da busca **não** são citações.
- **SPEC-R4-001:** nada muda; salvar as parts completas já preserva `citations` nos `TextUIPart`. Conferir que o `onEnd` recebe as partes com `citations`.
- **SPEC-R4-003:** usar `webSearch_20250305` / `webFetch_20250910`; marcações vêm de `part.citations`; a trilha conta os resultados de busca (`source-url`) como "N resultados".
