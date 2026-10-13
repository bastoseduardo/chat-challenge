# SPEC-R2-004 — Tool call streaming visual

**Esforço:** ~1h · **Prioridade:** P2

## Objetivo
Melhorar o card de tool call pra mostrar os args sendo construídos (`input-streaming`), executando (`input-available`), com resultado (`output-available`) ou erro (`output-error`). Usar os estados do AI SDK 7 UIMessagePart.

## Acceptance criteria

- [ ] Card de tool mostra 4 estados visuais distintos: streaming / running / done / error
- [ ] Enquanto args são gerados, aparece spinner + nome da tool em cinza
- [ ] Resultado é colapsável (abre/fecha ao clicar)
- [ ] Erro mostra em vermelho + mensagem
- [ ] Nome da tool é formatado (ex: `web_search` → "Web search", `user-notes__save_note` → "User-notes · Save note")

## Tasks

1. [ ] Refatorar `components/chat/message-bubble.tsx` extraindo `<ToolCallCard>` separado
2. [ ] Switch pelos 4 estados do UIMessagePart (`state: "input-streaming" | "input-available" | "output-available" | "output-error"`)
3. [ ] Prettify tool name (lookup table + split por `__`)
4. [ ] Collapsible via `useState` (fechado por padrão quando `output-available`)
5. [ ] Ícones: `Loader2`, `Wrench`, `Check`, `AlertCircle` do lucide
6. [ ] Formatar args/result como JSON indentado quando object, string direto quando string

## #PATH_DECISION
Usar os estados nativos do AI SDK em vez de implementar state machine própria.
