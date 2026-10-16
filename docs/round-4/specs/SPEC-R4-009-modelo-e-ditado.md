# SPEC-R4-009: Modelo na resposta + ditado por voz

**Esforço:** ~0,5 dia · **Prioridade:** P2 · **Depende de:** — · **Bloqueia:** —
**Pode rodar junto com:** qualquer · **Tasks:** R4091–R4094

## Objetivo
Dois detalhes que sinalizam cuidado: saber qual modelo respondeu e poder ditar no celular.

## Escopo
1. **Modelo:** `messageMetadata` do `/api/chat` passa a incluir `model` no evento `start` (hoje só manda `usage` no `finish`). Mensagens antigas: `listMessagesWithAttachments` preenche `metadata.model` a partir de `messages.model`.
2. Rodapé da resposta (ao lado das ações): nome legível via `MODELS` de `lib/ai/pricing.ts` ("Sonnet 4.6"), `text-xs text-muted-foreground`. Em componente novo `components/chat/answer-meta.tsx`, plugado com 1 linha no `AssistantMessage`.
3. **Ditado:** botão de microfone no composer (`components/chat/composer.tsx`), à esquerda do enviar.
   - Web Speech API (`SpeechRecognition`/`webkitSpeechRecognition`), `lang = "pt-BR"`, `interimResults = true`.
   - Só aparece se a API existir. Estado gravando: ícone preenchido + `aria-pressed`, texto "Ouvindo…" na linha de dicas.
   - O texto ditado entra no fim do que já está digitado.
   - Erro de permissão: toast "Permita o microfone nas configurações do navegador pra ditar."

## Arquivos
- Modificar: `app/api/chat/route.ts` (só `messageMetadata`), `lib/db/queries/messages-with-attachments.ts` (só `metadata.model`), `components/chat/composer.tsx`, `components/chat/message-bubble.tsx` (1 linha)
- Criar: `components/chat/answer-meta.tsx`, `hooks/use-dictation.ts`

## Conflitos
`app/api/chat/route.ts` e `messages-with-attachments.ts` também são tocados pela R4-001: fazer **depois** dela ou mexer só nas linhas indicadas.

## Acceptance criteria
- [ ] Resposta nova e antiga mostram o modelo.
- [ ] Chrome desktop e Android: ditar preenche o composer; Firefox: botão não aparece.
- [ ] axe sem violações no composer.

## Notas da implementação (2026-10-16)
- Modelo: `messageMetadata` manda `{ model }` no `start` (o `usage` continua no `finish`); `listMessagesWithAttachments` preenche `metadata.model` com `messages.model`. Rodapé em `answer-meta.tsx`, junto da linha de confiança: "Sonnet 4.6 · 2 fontes, a mais recente de out/2026". Fica fora do relatório público (o share não traz metadata).
- Ditado: `hooks/use-dictation.ts` (`continuous`, `interimResults`, pt-BR), botão de microfone à esquerda do enviar, só quando a API existe (`useSyncExternalStore`, falso na hidratação). Enviar com Enter para o ditado. Erro `not-allowed` → toast pedindo o microfone.
- Validado com um `webkitSpeechRecognition` falso no Playwright: texto provisório e final entram depois do que já estava digitado, "Ouvindo…" + `aria-pressed`, permissão negada mostra o toast, sem a API o botão não aparece; modelo na resposta nova e após recarregar; axe sem violações com o composer ouvindo. **Não testado com microfone real** (Chrome desktop/Android): fica pra validação manual.
