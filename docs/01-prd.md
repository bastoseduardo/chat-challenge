# PRD — Chat Challenge

**Versão:** 1.0
**Data:** 2026-10-12
**Status:** Aprovado para execução
**Ref:** [00-discovery.md](./00-discovery.md)

---

## 1. Visão

Uma aplicação de chat multi-conversa de nível profissional, demonstrando domínio em **integração com LLMs (vision, tool use, MCP)**, **persistência rastreável** e **governança de uso (caps + audit)**. Entregue como link público em 72h.

### 1.1 Elevator pitch

> "Um ChatGPT-like completo em 3 dias: múltiplas conversas, imagens, PDFs, web search ao vivo, MCP, compaction automática, orçamento de tokens contabilizado e tudo auditado. Tudo compartilhável por link."

### 1.2 Fora de visão (ver [Discovery §5](./00-discovery.md))

Edição de mensagens, multi-modelo, admin UI para caps, i18n, rota /demo.

---

## 2. Personas

### P1 — Avaliador técnico (primário)
- **Perfil:** engenheiro sênior/arquiteto julgando o teste.
- **Objetivo:** validar se os 10 requisitos funcionam no deploy público em <10 min.
- **Dor:** demos quebradas, logins complicados, features "fake".
- **Como ganha:** golden path (§6) roda do início ao fim sem travar.

### P2 — Usuário final (secundário)
- **Perfil:** profissional usando o chat pra Q&A, análise de docs, pesquisa web.
- **Objetivo:** conversar, anexar arquivos, pesquisar, voltar depois.
- **Dor:** perder histórico, não saber quanto tokens gastou, não conseguir compartilhar.
- **Como ganha:** histórico persistente, uso visível, share em 1 clique.

---

## 3. User stories

Prioridade: **P0** (bloqueador do MVP) · **P1** (importante) · **P2** (nice-to-have)

### Core chat

- **US-001** [P0] Como usuário, quero fazer login com Google para acessar minhas conversas.
- **US-002** [P0] Como usuário, quero criar múltiplas conversas e vê-las na sidebar ordenadas por última atividade.
- **US-003** [P0] Como usuário, quero enviar mensagens e receber respostas em streaming.
- **US-004** [P0] Como usuário, quero que meu histórico persista entre sessões.
- **US-005** [P1] Como usuário, quero renomear/deletar conversas.
- **US-006** [P1] Como usuário, quero que o título da conversa seja gerado automaticamente após a 1ª resposta.

### Attachments

- **US-007** [P0] Como usuário, quero anexar imagens (até 10 MB, até 5 por msg) e o modelo analisá-las (vision).
- **US-008** [P0] Como usuário, quero anexar PDFs (até 20 MB) e o modelo lê-los.
- **US-009** [P1] Como usuário, quero ver thumbnails dos anexos e re-abrir o original.

### Tools

- **US-010** [P0] Como usuário, quero que o modelo pesquise na web quando necessário (`web_search`).
- **US-011** [P0] Como usuário, quero que o modelo extraia conteúdo de URLs (`web_scrape`).
- **US-012** [P0] Como usuário, quero ativar/desativar tools nas configurações.
- **US-013** [P1] Como usuário, quero adicionar servers MCP via config JSON nas settings.
- **US-014** [P2] Como usuário, quero conectar Google Drive para o modelo acessar meus arquivos.

### Compaction

- **US-015** [P0] Como sistema, ao atingir 80% do context window, devo resumir mensagens antigas e continuar a conversa sem interrupção para o usuário.
- **US-016** [P1] Como usuário, quero ver um badge discreto indicando que o histórico foi comprimido N vezes.

### Caps & usage

- **US-017** [P0] Como sistema, devo contabilizar tokens (input+output) e custo USD por request.
- **US-018** [P0] Como usuário, ao atingir meu cap diário, devo ser bloqueado com modal explicativo.
- **US-019** [P0] Como admin, devo ter um cap global que, se estourado, bloqueia novas chamadas de todos.
- **US-020** [P1] Como usuário, quero ver meu consumo (tokens + USD) na UI.

### Share

- **US-021** [P0] Como usuário, quero gerar um link público read-only de uma conversa.
- **US-022** [P0] Como visitante do link, quero visualizar a conversa (mensagens + anexos) sem login.
- **US-023** [P0] Como usuário, quero revogar o share.
- **US-024** [P1] Como visitante, quero que o share reflita mensagens novas enviadas pelo dono (live).

### Audit

- **US-025** [P0] Como sistema, devo registrar todos os eventos relevantes em `audit_events`.
- **US-026** [P1] Como admin, quero uma página `/admin/audit` com lista filtrável de eventos.

### Operação

- **US-027** [P0] Como time, a aplicação deve estar deployada em cloud pública acessível por link.
- **US-028** [P0] Como time, o repo deve ter README com setup, link do deploy e link do vídeo.

---

## 4. Fluxos principais

### 4.1 Fluxo de mensagem (happy path)

```
1. User digita mensagem [+ anexos opcionais]
2. Client faz upload de anexos → Supabase Storage
3. POST /api/chat (conversationId, content, attachment_ids)
4. Server:
   a. Checa cap de tokens (user + global)
   b. Carrega histórico (incluindo summary messages se houver)
   c. Chama AI SDK streamText com modelo + tools habilitadas
   d. Tool calls intermediárias registradas em tool_invocations
   e. Streaming SSE pro client
   f. Ao finalizar: persiste mensagem + usage_event + audit_event
   g. Se tokens > 80% ctx: dispara compaction async
```

### 4.2 Fluxo de compaction

```
1. Trigger: ao calcular tokens pós-resposta, verificar se > 80% do ctx
2. Selecionar mensagens "antigas" (todas exceto últimas N=10 + summary existente)
3. LLM call: "Resuma esta conversa preservando contexto decisivo"
4. Criar nova mensagem com role='system', is_summary=true
5. Marcar mensagens resumidas como summarizes_until
6. Próxima request usa: [summary] + [últimas N] como contexto
7. Audit: compaction.executed { tokens_before, tokens_after, messages_summarized }
```

### 4.3 Fluxo de share

```
1. User clica "Compartilhar" na conversa
2. POST /api/conversations/:id/share → gera token (nanoid)
3. Insere em shares (token, created_by, conversation_id)
4. Retorna /share/<token>
5. Visitante acessa → RPC public.get_shared_conversation(token)
   - Verifica revoked_at IS NULL
   - Retorna conversa + mensagens + anexos (URLs assinadas 1h)
6. Revogação: UPDATE shares SET revoked_at = now()
```

---

## 5. Métricas de sucesso

| Métrica | Alvo | Como medir |
|---|---|---|
| Deploy público acessível | 100% uptime no período de avaliação | manual |
| Golden path (vídeo) completo | 100% dos 9 passos funcionam | demo gravada |
| Todos R1-R10 atendidos | 10/10 | checklist delivery |
| Latência 1º token (streaming) | < 2s mediana | observação em dev |
| Tempo de setup local (README) | < 15 min | validação pessoal |
| Diferenciais implementados | ≥ MCP | checklist |
| Zero vazamento RLS | 0 cross-user leaks | smoke test manual |

---

## 6. Golden path (recorte do Discovery §9)

Login → Nova conversa → PDF (vision) → Imagem (vision) → Pergunta com web_search → Pergunta com MCP tool → Share link funcionando → Painel de uso → Página audit.

---

## 7. Mapa PRD → Specs

| User Stories | Spec |
|---|---|
| US-001 a US-006 | SPEC-001 Chat Core |
| US-007 a US-009 | SPEC-002 Attachments |
| US-010 a US-014 | SPEC-003 Tools & MCP |
| US-015, US-016 | SPEC-004 Auto-compaction |
| US-017 a US-020, US-025, US-026 | SPEC-005 Cap & Audit |
| US-021 a US-024 | SPEC-006 Share |
| US-027, US-028 | SPEC-007 Deploy |

---

## 8. Riscos de produto

Ver [00-discovery.md §7](./00-discovery.md). Mitigações já no plano.

