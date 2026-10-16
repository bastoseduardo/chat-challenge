// Contrato de fontes (SPEC-R4-000 §2). Usado por citações, caderno e relatório.

export type SourceKind = "web" | "document"

export interface Source {
  /** Número exibido ([1], [2]...), estável na mensagem, por ordem de primeira aparição. */
  index: number
  kind: SourceKind
  title: string
  /** web */
  url?: string
  /** web, sem "www." */
  domain?: string
  /** documento (PDF), páginas inclusivas, 1-indexed */
  pages?: { start: number; end: number }
  /** trechos citados, sem duplicatas */
  quotes: string[]
  /** ids das fontes no AI SDK que viraram esta Source */
  sourceIds: string[]
}
