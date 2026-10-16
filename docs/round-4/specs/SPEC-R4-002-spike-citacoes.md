# SPEC-R4-002: Spike de citações

**Esforço:** ~2 h · **Prioridade:** P0 · **Depende de:** — · **Bloqueia:** decisão da 003
**Pode rodar junto com:** 001, 004, 009, 011 · **Tasks:** R4011–R4014

## Objetivo
Responder, com dados, como implementar as citações da web antes de construir a UI: ferramentas nativas da Anthropic (decisão A) ou Tavily/Jina com marcações próprias (decisão B).

## Perguntas que o spike responde
1. Com `webSearch_20260209` + `webFetch_20260209` no `claude-sonnet-4-6`, as partes chegam **intercaladas** (texto, fonte, texto, fonte), permitindo saber qual frase cada fonte sustenta? Ou as fontes vêm agrupadas?
2. Com um PDF em file part com `providerOptions.anthropic.citations.enabled`, chegam `source-document` com `citedText` e páginas?
3. Custo (busca nativa é cobrada por busca, além dos tokens) e latência em 5 perguntas reais, comparados com o fluxo atual (Tavily).
4. As ferramentas nativas aparecem como partes de ferramenta no stream (pra trilha), com `input` (query/URL) legível?

## Como fazer
- `scripts/spike-citations.ts` executado com `npx tsx` (o projeto já usa `tsx` em `scripts/`), usando `streamText` + `getModel()` de `lib/ai/client.ts` e iterando `result.toUIMessageStream()` pra imprimir a sequência de partes.
- PDF: qualquer PDF público pequeno (2–5 páginas).
- Não toca no app.

## Entregável
`docs/round-4/decisions/citations.md` com:
- sequência de partes observada (copiar um trecho do log);
- tabela custo/latência A vs atual;
- **decisão A ou B** e o porquê;
- ajustes necessários na R4-003 (editar a spec).

## Critério de decisão
Escolher **A** se (1) e (4) forem "sim" e o custo por pergunta ficar abaixo de ~US$ 0,05. Senão, **B**.

## Arquivos
- Criar: `scripts/spike-citations.ts`, `docs/round-4/decisions/citations.md`
