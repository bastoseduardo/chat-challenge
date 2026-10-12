# SPEC-004 — Auto-compaction

**User stories:** US-015, US-016
**Dependências:** SPEC-001
**Estimativa:** ~3h

## Objetivo
Quando a conversa atingir 80% do context window do modelo, resumir mensagens antigas em uma `summary message` e continuar o chat sem interrupção.

## Acceptance criteria

- [ ] AC-1 Após cada resposta, calcular tokens totais usados.
- [ ] AC-2 Se `total_tokens >= 0.8 * CTX_WINDOW` (160k p/ Sonnet 4.6), disparar compaction async.
- [ ] AC-3 Compaction NÃO bloqueia a UI do usuário (fire-and-forget após o stream fechar).
- [ ] AC-4 Compaction cria mensagem `role='system'`, `is_summary=true`, com texto resumido.
- [ ] AC-5 Marca mensagens resumidas via `summarizes_until_message_id` (ponto de corte).
- [ ] AC-6 Próxima request carrega: `[última summary] + [mensagens após o corte]`.
- [ ] AC-7 `conversations.compaction_count` incrementa.
- [ ] AC-8 Badge na UI exibe "Histórico comprimido Nx" quando `compaction_count > 0`.
- [ ] AC-9 `audit_events` registra `compaction.executed` com `tokens_before`, `tokens_after`, `messages_summarized`.
- [ ] AC-10 Custo da summarização conta em `usage_events` com `event_kind='compaction'`.

## Modelo de dados
- `messages.is_summary`, `messages.summarizes_until_message_id`
- `conversations.compaction_count`, `total_input_tokens`, `total_output_tokens`

## Algoritmo

```ts
async function compactIfNeeded(conversationId) {
  const conv = await getConversation(conversationId)
  const ctxLimit = CTX_WINDOW[conv.model]
  const estimated = conv.total_input_tokens + conv.total_output_tokens

  if (estimated < 0.8 * ctxLimit) return

  const msgs = await getMessagesSinceLastSummary(conversationId)
  const toSummarize = msgs.slice(0, -KEEP_RECENT) // mantém últimas 10
  if (toSummarize.length < 4) return // nada a resumir

  const summary = await summarizeWithLLM(toSummarize)
  // insere summary e marca corte
  await db.transaction(async tx => {
    await tx.insert(messages).values({
      conversation_id: conversationId,
      role: 'system',
      content: [{ type: 'text', text: summary.text }],
      is_summary: true,
      summarizes_until_message_id: toSummarize.at(-1).id,
    })
    await tx.update(conversations)
      .set({ compaction_count: sql`compaction_count + 1` })
      .where(eq(conversations.id, conversationId))
    await logUsage({ ...summary.usage, event_kind: 'compaction' })
    await logAudit('compaction.executed', { ... })
  })
}
```

## Prompt de summarization

```
Você é um compressor de histórico de chat. Resuma a conversa abaixo preservando:
- Decisões tomadas e seus porquês
- Fatos e dados que o usuário mencionou
- Tarefas em andamento
- Estado atual do raciocínio

Formato: markdown com seções (Decisões, Fatos, Pendências). Máximo 500 tokens.

<conversation>
{{messages}}
</conversation>
```

## Build context (próxima request)

```ts
function buildContext(conversationId) {
  const lastSummary = await getLastSummary(conversationId)
  const since = lastSummary?.summarizes_until_message_id ?? null
  const recent = await getMessagesAfter(conversationId, since)
  return [
    ...(lastSummary ? [lastSummary] : []),
    ...recent,
  ]
}
```

## Tasks

1. [ ] Função `estimateTokens(msgs)` (approx: chars/4)
2. [ ] `lib/ai/compaction.ts` com `compactIfNeeded`
3. [ ] Chamada no onFinish do `/api/chat`
4. [ ] Função `buildContext` em `lib/ai/history.ts`
5. [ ] Badge "comprimido Nx" no header
6. [ ] Audit log do evento
7. [ ] Usage event da compaction
8. [ ] Teste manual: forçar `CTX_WINDOW=5000` temporariamente e disparar

## Riscos
- **Perda de contexto crítico pós-compaction** → prompt enfatiza decisões; manter últimas 10 msgs intactas.
- **Fire-and-forget em serverless** → usar `waitUntil()` do Vercel pra garantir execução.

## #PATH_DECISION
Compaction async no mesmo request (via `waitUntil`), não em cron. Simples e determinístico.
