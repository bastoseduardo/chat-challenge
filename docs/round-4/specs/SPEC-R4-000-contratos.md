# SPEC-R4-000: Contratos compartilhados e como validar

**Tipo:** referência (não tem tasks próprias). Toda spec do Round 4 assume o que está aqui.

## 1. Fatos do stack (verificados em `node_modules`, 2026-10-15)

| Fato | Onde |
|---|---|
| `ai@7`: partes de fonte na `UIMessage` são `source-url` (`sourceId`, `url`, `title?`, `providerMetadata?`) e `source-document` (`sourceId`, `mediaType`, `title`, `filename?`, `providerMetadata?`) | `node_modules/ai/dist/index.d.ts` |
| `toUIMessageStreamResponse` **não envia fontes por padrão**: precisa `sendSources: true` | idem, `sendSources?: boolean` |
| Callback de fim: `onEnd({ responseMessage, messages, isAborted, ... })`. `onFinish` é alias obsoleto | idem, `UIMessageStreamOnEndCallback` |
| Partes de dados próprias: tipo `` `data-${NAME}` ``; emitidas com `createUIMessageStream({ execute: ({ writer }) => { writer.write(...); writer.merge(result.toUIMessageStream()) } })` | idem |
| `@ai-sdk/anthropic@4.0.79`: file part aceita `providerOptions.anthropic.citations: { enabled: true }` (+ `title`); citações de PDF viram `source-document` com `providerMetadata.anthropic.{ citedText, startPageNumber, endPageNumber }` | `node_modules/@ai-sdk/anthropic/dist/index.js` |
| Ferramentas nativas: `anthropic.tools.webSearch_20260209`, `webFetch_20260209` (citações na busca sempre ligadas; na leitura, `citations: { enabled: true }`) | idem |
| Modelos do app: `lib/ai/pricing.ts` (`DEFAULT_MODEL = "claude-sonnet-4-6"`) | código |

## 2. Contrato de fontes (criado pela R4-001, usado por 003, 005, 007, 012)

```ts
// lib/sources/types.ts
export type SourceKind = "web" | "document"

export interface Source {
  /** Número exibido ([1], [2]...), estável dentro da mensagem, por ordem de primeira aparição */
  index: number
  kind: SourceKind
  title: string
  url?: string            // web
  domain?: string         // web, sem "www."
  pages?: { start: number; end: number } // documento PDF
  quotes: string[]        // trechos citados (citedText), sem duplicatas
  sourceIds: string[]     // sourceId das partes que viraram esta fonte
}

// lib/sources/extract.ts
export function extractSources(message: UIMessage): Source[]
/** Pra cada índice de part da mensagem, quais Source.index ela cita. */
export function citationsByPart(message: UIMessage): Map<number, number[]>
export function sourceLabel(s: Source): string // "postgresql.org" ou "relatorio.pdf, p. 4–5"
```

Regras: fontes com a mesma `url` (ou mesmo `title` + `pages` em documento) são a mesma `Source`. Ordem pela primeira aparição.

## 3. Contrato de ids de mensagem (criado pela R4-001)

O id da mensagem do assistente é gerado **no servidor** (`generateMessageId: () => crypto.randomUUID()` no `toUIMessageStreamResponse`) e é o mesmo id gravado em `messages.id`. Assim, logo após o stream, o cliente já tem o id real (necessário pra "guardar no caderno" com `message_id` e pra âncoras `#msg-<id>`).

## 4. Validação logada (padrão de todas as specs)

```bash
npm run dev
# navegador: /login → "Entrar sem Google (dev)"
```

Playwright logado (base dos roteiros usados no Round 3):

```ts
await page.goto("http://localhost:3000/auth/dev-login?next=/c/new")
// ... roteiro ...
// limpeza: tudo que foi criado
await page.request.delete(`/api/conversations/${id}`)
```

Auditoria de acessibilidade (axe via cdnjs, sem instalar dependência):

```ts
await page.addScriptTag({ url: "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js" })
const violations = await page.evaluate(async () =>
  (await axe.run(document, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] },
    exclude: [["nextjs-portal"]],
  })).violations
)
```

E2E que precisa de login segue o padrão de `tests/e2e/optimistic-sidebar.spec.ts`: `test.skip(!process.env.E2E_DEV_LOGIN, ...)`, cria os próprios dados via API e apaga no `finally`.

## 5. Design (herdado do Round 3)

- Tokens em `app/globals.css`: `--tool` (ocre) é exclusivo de atividade de ferramenta e de fontes; `--primary` (tinta) pra ações.
- Respostas em `.markdown-reading` (serif). Marcações de citação em sans, pequenas, cor `--tool`.
- Sem cards repetidos como decoração; sem caixa alta em rótulos; motion só em resposta a ação.
- Alvos de toque: `pointer-coarse:size-11`.
