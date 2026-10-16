import { z } from "zod"

// Validação dos payloads do Caderno (SPEC-R4-004). Compartilhada entre as rotas
// e os testes.

const trimmed = (max: number) => z.string().trim().min(1).max(max)

export const createNoteSchema = z
  .object({
    content: z.string().trim().max(20_000).optional(),
    title: trimmed(200).optional(),
    quote: trimmed(5_000).optional(),
    source: z
      .object({
        // Só http(s): o link da fonte vira <a href> no Caderno.
        url: z
          .string()
          .url()
          .max(2_000)
          .refine((u) => /^https?:\/\//i.test(u), "A fonte precisa ser um link http(s)")
          .optional(),
        title: trimmed(300).optional(),
        page: z.number().int().positive().max(100_000).optional(),
      })
      .optional(),
    conversationId: z.string().uuid().optional(),
    messageId: z.string().uuid().optional(),
  })
  // Uma nota precisa de texto: o conteúdo ou o trecho guardado.
  .refine((v) => !!(v.content?.trim() || v.quote?.trim()), {
    message: "Informe o conteúdo ou o trecho da nota",
    path: ["content"],
  })

export type CreateNoteInput = z.infer<typeof createNoteSchema>

export const updateNoteSchema = z
  .object({
    content: z.string().trim().min(1).max(20_000).optional(),
    title: z.string().trim().max(200).nullable().optional(),
    restore: z.literal(true).optional(),
  })
  .refine((v) => v.content !== undefined || v.title !== undefined || v.restore, {
    message: "Nada pra atualizar",
  })

export type UpdateNoteInput = z.infer<typeof updateNoteSchema>

export const listNotesQuerySchema = z.object({
  conversationId: z.string().uuid().optional(),
  cursor: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
})

export const searchNotesQuerySchema = z.object({
  q: z.string().trim().min(1).max(500),
})
