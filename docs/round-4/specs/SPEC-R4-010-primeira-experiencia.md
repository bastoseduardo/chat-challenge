# SPEC-R4-010: Primeira experiência dos avaliadores

**Esforço:** ~1 dia · **Prioridade:** P0 pra demo · **Depende de:** 003 (citações), 005 (caderno) · **Bloqueia:** —
**Pode rodar junto com:** 006, 008 (a estrutura pode começar antes; os itens do checklist ligam quando 003/005 entram) · **Tasks:** R4101–R4105

## Objetivo
Quem entra pela primeira vez vê os diferenciais em até 3 minutos, sem ninguém explicar. (Avaliadores já estão cadastrados como usuários de teste no OAuth, então o login não é obstáculo.)

## Escopo
1. **Boas-vindas** (só quando o usuário não tem nenhuma conversa): substitui o `EmptyState` em `/c/new`.
   - Título: "Pesquise com as fontes à vista." Uma frase: "O Seshat busca, lê e cita de onde veio cada informação. O que for útil, você guarda no caderno."
   - Botão principal **"Ver uma pesquisa de exemplo"**: envia de verdade a pergunta curada (constante em `lib/demo/sample-prompt.ts`), escolhida pra disparar busca + leitura e render 2–4 citações. Sugestão: "Qual a versão estável mais recente do PostgreSQL e até quando ela tem suporte? Cite as fontes."
   - Atalhos da tela vazia atual continuam abaixo.
2. **Painel "O que observar"**: cartão pequeno, recolhível, no canto inferior direito da conversa (acima do composer no mobile), com 4 itens marcáveis que se marcam sozinhos quando acontecem:
   1. "Passe o mouse num [1] pra ver o trecho citado" (marca quando um `SourceCard` abre);
   2. "Abra a trilha de pesquisa" (marca quando um passo é expandido);
   3. "Selecione uma frase e guarde no caderno" (marca no toast de nota criada);
   4. "Compartilhe e abra o relatório" (marca quando o diálogo gera o link).
   Estado em `localStorage` (`seshat:tour`), com try/catch; "Dispensar" esconde de vez. Eventos via um pequeno emissor (`lib/demo/tour.ts`) que os componentes das R4-003/005/007 chamam (1 linha cada).
3. **README:** seção "Roteiro de 3 minutos" (copiar do plano, §9) + GIF de ~15 s no topo (Playwright `recordVideo` → converter com ffmpeg, ou gravar manualmente).
4. **Cotas:** conferir `USER_DAILY_TOKEN_CAP` na Vercel com folga pra ~10 perguntas por avaliador (registrar o valor na spec).

## Arquivos
- Criar: `components/onboarding/welcome.tsx`, `components/onboarding/tour-panel.tsx`, `lib/demo/sample-prompt.ts`, `lib/demo/tour.ts`
- Modificar: `components/chat/chat-view.tsx` (trocar `EmptyState` por `Welcome` quando `conversations.length === 0`), `README.md`, e 1 linha em cada: `components/chat/citations.tsx`, `components/chat/research-trail.tsx`, `components/chat/selection-to-save.tsx`, `components/chat/share-dialog.tsx`

## Validação sem conta nova
Como o dev-login usa a conta do autor (com conversas), permitir forçar a tela: `/c/new?welcome=1` **só em `NODE_ENV=development`**.

## Acceptance criteria
- [ ] Conta sem conversas (ou `?welcome=1` em dev) mostra boas-vindas; o exemplo roda e gera citações.
- [ ] Os 4 itens se marcam sozinhos ao fazer o roteiro; "Dispensar" persiste após recarregar.
- [ ] Mobile 390: painel não cobre o composer.
- [ ] README com roteiro e GIF.
- [ ] Cronometrar o roteiro completo: ≤ 3 min.
