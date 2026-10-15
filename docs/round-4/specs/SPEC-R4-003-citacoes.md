# SPEC-R4-003: Citações

**Esforço:** ~2 dias · **Prioridade:** P0 · **Depende de:** 001, 002 · **Bloqueia:** 010, 012
**Pode rodar junto com:** 005, 007 · **Tasks:** R4021–R4030

## Objetivo
Toda afirmação apoiada numa fonte mostra uma marcação `[n]`. A marcação abre o trecho citado e a fonte (página, no caso de PDF). É a promessa do login ("respostas que mostram de onde vieram") virando verdade.

## Contexto
- Contrato `lib/sources` e partes `source-*` persistidas: R4-001.
- Decisão A/B: `docs/round-4/decisions/citations.md` (R4-002). **Ler antes de começar.**
- `components/chat/message-bubble.tsx` (`AssistantMessage` agrupa ferramentas em `ResearchTrail` e renderiza texto com `Markdown`).
- `components/chat/research-trail.tsx` (`describe()` traduz cada ferramenta numa frase).

## Escopo

### Servidor
1. **PDF:** em `lib/ai/history.ts` (`buildContext`), file parts de PDF recebem `providerOptions: { anthropic: { citations: { enabled: true }, title: <nome do arquivo> } }`.
2. **Web, decisão A:** em `lib/ai/tools/index.ts`, `web_search` e `web_scrape` passam a ser `anthropic.tools.webSearch_20260209({ maxUses: 5 })` e `anthropic.tools.webFetch_20260209({ citations: { enabled: true }, maxUses: 5 })`. Os toggles de Configurações continuam com os mesmos ids. Tavily/Jina ficam no código, desativados.
   **Decisão B:** saída do `web_search` numera resultados (`ref`) por requisição (contador num objeto criado por request e passado a `getBuiltinTools`); o modelo cita `[ref]`; o servidor converte `[n]` em partes `source-url` no `onEnd` antes de salvar (mesmo contrato).
3. **Instrução de sistema** (no `BASE_SYSTEM` do `/api/chat`): ao usar ferramentas, apoiar afirmações factuais nas fontes; quando a resposta vier só do conhecimento do modelo, dizer isso numa frase.

### Interface
4. `components/chat/citations.tsx`:
   - `CitationMark`: `[n]` sobrescrito, sans, cor `--tool`, botão acessível (`aria-label="Fonte n: <sourceLabel>"`).
   - `SourceCard`: popover (Radix, já disponível via shadcn) com título, `sourceLabel`, trechos citados entre aspas (até 2) e "Abrir fonte". Abre no hover/foco no desktop e no toque no mobile.
   - `SourcesList`: bloco "Fontes" no fim da resposta, numerado; recolhido com "Ver todas as N fontes" quando > 3.
5. `AssistantMessage`: usar `citationsByPart` pra inserir `CitationMark` logo após o texto que cada fonte sustenta. Se o spike mostrar fontes agrupadas no fim, colocar as marcações ao fim do parágrafo anterior ao grupo.
6. **Trilha ↔ marcações:** `onMouseEnter`/`onFocus` num passo da trilha destaca (`data-highlight`) as marcações das fontes que ele gerou, e vice-versa. Estado num contexto React local da mensagem; nada global.
7. **Sinal de confiança** no rodapé (ao lado das ações): "3 fontes, a mais recente de out/2026" quando há data, ou "Sem fontes externas" quando a resposta não usou ferramentas. Nada de porcentagem de "confiança".
8. `research-trail.tsx`: `describe()` cobre as ferramentas nativas (decisão A) com as mesmas frases ("Buscou na web “…”", "Leu dominio.com").
9. Copiar resposta e `GET /api/conversations/[id]/export?format=md` incluem as fontes como notas de rodapé (`[^1]: título, URL`).

## Fora de escopo
Fontes no relatório compartilhado (R4-007 usa `SourcesList`). Guardar trecho (R4-005).

## Arquivos
- Modificar: `lib/ai/history.ts`, `lib/ai/tools/index.ts`, `app/api/chat/route.ts` (só `BASE_SYSTEM` e, se B, conversão no `onEnd`), `components/chat/message-bubble.tsx`, `components/chat/research-trail.tsx`, `app/api/conversations/[id]/export/route.ts`
- Criar: `components/chat/citations.tsx`

## Acceptance criteria
- [ ] Pergunta factual com busca: ≥1 marcação; hover mostra trecho e domínio; "Abrir fonte" abre a URL.
- [ ] PDF anexado + pergunta: marcação com "nome.pdf, p. X".
- [ ] Recarregar mantém tudo (vem da R4-001).
- [ ] Hover num passo da trilha destaca as marcações correspondentes.
- [ ] Teclado: Tab chega nas marcações; Enter abre o cartão; Esc fecha.
- [ ] Mobile 390: toque abre o cartão; nada de scroll horizontal.
- [ ] axe sem violações na conversa (claro e escuro).
- [ ] Export Markdown com notas de rodapé.
- [ ] Toggle "Pesquisar na web" desligado em Configurações realmente remove a ferramenta.

## Riscos
- Popover em texto que ainda está em streaming pisca. **Mitigação:** só renderizar marcações quando a parte de texto seguinte já começou ou o stream acabou.
- Decisão A muda o custo por pergunta. **Mitigação:** `maxUses` e números do spike.
