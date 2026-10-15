# Round 3 — Interface e experiência

**Data:** 2026-10-15
**Base:** skills *Frontend Design* (Anthropic) + *UI/UX Pro Max* (product "AI/Chatbot Platform" #18, UX guidelines, stack `nextjs`/`shadcn`)

Objetivo: tirar o app do visual "shadcn padrão" e eliminar a sensação de recarregamento. O chat deve parecer um app contínuo: a sidebar não pisca, nada some e reaparece, e cada ação tem resposta imediata.

---

## 1. Diagnóstico

### 1.1 Por que parece que a página recarrega

| # | Causa | Onde | Efeito |
|---|---|---|---|
| D1 | `router.refresh()` ao fim de **toda** resposta | `chat-view.tsx:87` | Re-renderiza o layout RSC inteiro: auth + `listConversations` + página + `listMessagesWithAttachments`. Roda depois de cada mensagem |
| D2 | `router.refresh()` de novo depois de gerar o título | `chat-view.tsx:104` | Segundo re-render completo logo após o primeiro |
| D3 | Nova conversa faz POST → `router.push` → `router.refresh` → skeleton de `loading.tsx` → autostart | `new-chat-view.tsx:40-42`, `chat-view.tsx:128` | A tela troca de componente, pisca o skeleton e a URL muda duas vezes (`?autostart=1` → `/c/id`) |
| D4 | `export const dynamic = "force-dynamic"` no layout `/c` + sidebar alimentada só por props do servidor | `app/c/layout.tsx` | Qualquer mudança na lista (renomear, apagar, criar) exige refresh do servidor |
| D5 | Renomear e apagar esperam o servidor e depois chamam refresh | `sidebar.tsx:60-77` | Atraso visível; nada é otimista |
| D6 | `/settings` e `/usage` ficam fora do layout com sidebar | `app/settings`, `app/usage` | Sair do chat descarta o shell e volta com o botão "←" |
| D7 | Polling de 10s no `ContextIndicator` + `router.refresh()` ao compactar | `context-indicator.tsx:73,86` | Requisições constantes e outro refresh completo |
| D8 | `scrollTo({behavior:"smooth"})` em toda mudança de `messages` | `chat-view.tsx:109` | No streaming, o scroll anima a cada token e puxa o usuário de volta pro fim mesmo quando ele rolou pra cima |

### 1.2 UX e visual

- **Identidade:** tema slate padrão do shadcn com Geist (padrão do `create-next-app`). Não há nada que identifique o produto.
- **Mensagens:** as duas falas usam balão (`bg-primary` / `bg-muted`). Respostas longas do assistente ficam espremidas em 85% de largura com fundo cinza, ruim de ler.
- **Mobile:** a sidebar tem `w-64` fixa e não existe drawer. Abaixo de 768px o chat fica com ~100px úteis.
- **Composer:** o textarea não cresce com o texto, anexos ficam bloqueados na primeira mensagem (`new-chat-view.tsx:84`), não dá pra arrastar e soltar arquivos e os atalhos aparecem dentro do placeholder.
- **Ações destrutivas:** usam `confirm()` nativo. O soft delete já existe no banco e não é aproveitado pra oferecer "Desfazer".
- **Ações de mensagem:** só aparecem com `group-hover` e ficam invisíveis no toque e no teclado. Os botões de ícone não têm `aria-label`.
- **Código:** `github-dark.css` é usado sempre, inclusive no tema claro. Os blocos não têm botão de copiar nem rótulo de linguagem.
- **Ícones:** emoji 📎 usado como ícone em anexo (`message-bubble.tsx:89`).
- **Estado "Pensando...":** é um spinner genérico. Não mostra que o modelo está buscando na web ou lendo o Drive.
- **Erros:** só aparecem em toast. Não há erro inline com "Tentar de novo" na mensagem que falhou.
- **Sidebar:** lista plana sem agrupar por data. O input de renomear substitui a linha sem estilo de foco.
- **Acessibilidade:** sem skip link, sem `aria-live` pro streaming, sem tratamento de `prefers-reduced-motion`.

---

## 2. Direção visual

### 2.1 Brief

- **Produto:** assistente de pesquisa multi-conversa. Busca na web, lê páginas, PDFs, imagens e Drive, guarda notas.
- **Público:** desenvolvedores e avaliadores técnicos, em sessões longas no desktop e consultas rápidas no celular.
- **Trabalho principal da interface:** deixar a resposta legível e mostrar **de onde ela veio** (quais buscas, páginas e arquivos).

### 2.2 Conflito entre as skills, e a decisão

O UI/UX Pro Max recomenda para "AI/Chatbot Platform" a paleta *Neutral + AI Purple* (`#7C3AED` + ciano). O Frontend Design aponta o roxo de IA, o near-black com acento ácido e o creme com terracota como padrões genéricos que denunciam interface gerada. **Decisão:** usar as regras de UX do Pro Max (streaming, contraste, toque, estados) e não usar a paleta dele. A cor sai do assunto: uma bancada de pesquisa, com tinta de anotação e marca-texto.

**O que o motor do UI/UX Pro Max retornou** (`search.py --design-system`, consulta "AI chatbot conversational streaming", dials variance 4 / motion 3 / density 6):

| Saída | Decisão |
|---|---|
| Estilo **AI-Native UI**: pouca interface em volta, texto em streaming, cards de contexto, evitar "heavy chrome" e "slow response feedback" | **Adotado.** É a base da coluna sem balão e da trilha de pesquisa |
| Paleta `#7C3AED` roxo + `#0891B2` ciano sobre `#FAF5FF` | **Descartada** (padrão genérico, ver acima) |
| Tipografia Inter/Inter | **Descartada.** É o default de qualquer app; a busca de tipografia sugeriu Newsreader (desenhada pra leitura longa) como alternativa ao Source Serif 4 |
| Motion: scroll reveal com GSAP | **Descartado.** Num chat, cada mensagem entraria animada; o Frontend Design pede no máximo um momento orquestrado |
| A consulta com "research" retornou o padrão "Portfolio Grid" e Garamond acadêmica | Fora do tema, ignorado |

Por isso o design system **não foi persistido** em `design-system/MASTER.md`: a skill orienta não gravar saída que não foi validada. A fonte da verdade é este documento.

### 2.3 Tokens

**Cor.** Neutros frios de ardósia, uma tinta azul pra ações e um ocre que só aparece em atividade de ferramenta.

| Nome | Escuro (default) | Claro | Papel |
|---|---|---|---|
| Ardósia | `#151A21` | `#F5F6F8` | fundo |
| Bancada | `#1C222B` | `#FFFFFF` | sidebar, composer, popovers |
| Linha | `#2B333E` | `#DDE1E7` | bordas, divisórias |
| Grafite | `#E3E7EC` | `#1A2029` | texto |
| Tinta | `#8DB0DD` | `#2D5A8A` | primária: enviar, links, foco, item ativo |
| Marca-texto | `#D9A441` | `#A86F0B` | só ferramentas: trilha de pesquisa e citações |

O vermelho destrutivo continua semântico. Todos os pares precisam atingir **4.5:1** (texto) e **3:1** (UI), validado na Fase 1.

**Tipografia.** Três famílias, cada uma com um papel:

- **Instrument Sans:** interface (sidebar, botões, rótulos, mensagens do usuário).
- **Source Serif 4:** corpo das respostas do assistente. Texto longo de leitura, `line-height 1.65`, medida máxima de **68ch**. Isso separa visualmente quem está falando sem precisar de balão.
- **JetBrains Mono:** só em código. Não usar como enfeite em rótulos de dados.

Escala: 13 / 15 / 17 (corpo da resposta) / 20 / 26. Pesos 400 e 600. Rótulos em sentence case, sem caixa alta espaçada.

**Raio e profundidade.** Raio por hierarquia, em vez de um valor único: 6px em controles, 10px em composer e popovers, 0 em blocos de código colados à margem. Sombra só em elementos flutuantes (popover, dialog, composer fixo).

### 2.4 Layout

```
desktop ≥1024                                  mobile <768
┌────────────┬───────────────────────────────┐  ┌──────────────────────┐
│ + Nova  ⌘K │ Título editável     ◐ 42% ⚙ ↗ │  │ ☰  Título       ⚙ ↗ │
│            ├───────────────────────────────┤  ├──────────────────────┤
│ Hoje       │            ┌───────────────┐  │  │        ┌──────────┐ │
│ ▸ conversa │            │ msg do usuário│  │  │        │ usuário  │ │
│   conversa │            └───────────────┘  │  │        └──────────┘ │
│ Ontem      │  ┊ ① Buscou "rls postgres"    │  │ ┊ ① Buscou …        │
│   conversa │  ┊ ② Leu supabase.com/docs    │  │ Resposta em serif,  │
│            │  Resposta em serif, largura   │  │ largura total.      │
│            │  de leitura (68ch), sem balão │  │                      │
│            │  ⧉ ↻                          │  │ ⧉ ↻                 │
│ ────────── │ ┌───────────────────────────┐ │  │┌────────────────────┐│
│ Uso  Conf. │ │ 📎 Pergunte…          [↑] │ │  ││📎 Pergunte…    [↑]││
│ (avatar)   │ └───────────────────────────┘ │  │└────────────────────┘│
└────────────┴───────────────────────────────┘  └──────────────────────┘
```

- Coluna de conversa alinhada à esquerda dentro de um container de 720px. A mensagem do usuário fica à direita, compacta, em fundo `Bancada`. A resposta do assistente ocupa a largura toda, sem fundo.
- O composer flutua sobre o fim da conversa (sticky, com sombra) em vez de ficar numa faixa com `border-t`.
- Sidebar com 264px no desktop, 56px colapsada (só ícones) no tablet e drawer (`Sheet`) no mobile.

### 2.5 O elemento memorável: a trilha de pesquisa

A ousadia fica num lugar só. As chamadas de ferramenta deixam de ser cards empilhados e viram uma **trilha** na margem esquerda da resposta: uma linha vertical ocre com passos numerados ("Buscou X", "Leu domínio.com", "Abriu relatório.pdf"). A numeração faz sentido porque as chamadas são de fato uma sequência. Cada passo expande pra mostrar a entrada e a saída. No streaming, o passo ativo pulsa uma única vez e fica com o texto "Lendo…". Depois de concluída, a trilha recolhe para um resumo de uma linha ("3 fontes consultadas") e pode ser reaberta.

Todo o resto fica quieto: sem gradientes, sem animação de entrada em cada mensagem, sem hover em todo card.

### 2.6 Revisão contra os padrões genéricos

| Padrão genérico | Situação no plano |
|---|---|
| Roxo de IA | Descartado (seção 2.2) |
| Fundo creme com serif e terracota | O serif existe, mas sobre ardósia fria e restrito ao corpo das respostas |
| Kit de cards SaaS | A página de uso deixa de ser 3 cards idênticos e vira uma linha de números com uma barra de cota |
| Eyebrow em caixa alta, `·` como separador, `→` em botões | Proibidos no guia de copy |
| Mono em rótulos pequenos | Mono só em código |

---

## 3. Arquitetura de UX (fim dos reloads)

Princípio: o **servidor entrega o estado inicial** e o **cliente mantém o estado vivo**. `router.refresh()` deixa de ser usado como sincronização.

1. **Store de conversas no cliente.** Adicionar `@tanstack/react-query` com um provider no layout. O layout RSC busca a lista uma vez e passa como `initialData`. Sidebar, título e indicador de contexto leem do cache.
2. **Mutações otimistas.**
   - Renomear: atualiza o cache na hora; se der erro, faz rollback e mostra um toast.
   - Apagar: remove da lista na hora e mostra o toast "Conversa apagada · Desfazer" por 5s. O desfazer chama `PATCH {deletedAt:null}`, que já é soft delete. Isso substitui o `confirm()`.
   - Título: `POST /title` passa a **retornar** o título, que é gravado no cache. O título aparece no header e na sidebar com um fade curto.
3. **Nova conversa sem trocar de tela.** `/c/new` renderiza o mesmo `ChatView` com `conversationId` nulo. Ao enviar:
   - o `/api/chat` aceita `conversationId` ausente, cria a conversa e devolve o id em `messageMetadata` (ou num data part) no início do stream;
   - o cliente faz `window.history.replaceState(null, "", "/c/" + id)` (o App Router do Next 16 sincroniza com `usePathname`) e insere a conversa no topo do cache;
   - resultado: nenhuma navegação, nenhum skeleton, nenhum `?autostart=1`, e anexos funcionando já na primeira mensagem. `NewChatView`, o `autoStartedConvs` e o fluxo de autostart são removidos.
4. **Uso e contexto via stream.** O `onFinish` do servidor anexa `{ totalTokens, compactionCount }` em `messageMetadata`, e o cliente atualiza o cache. Isso remove o polling de 10s. A compactação em background é exibida pela próxima resposta ou pelo diálogo, que busca os dados ao abrir.
5. **Shell único.** Mover `c/`, `settings/`, `usage/` e `admin/` para um route group `app/(app)/` com o layout que contém a sidebar. Tirar `force-dynamic` do layout (a auth já roda no `proxy.ts`). Configurações e uso abrem dentro do shell, sem "←".
6. **Troca de conversa instantânea.** `<Link prefetch>` nos itens da sidebar. O `loading.tsx` de `/c/[id]` passa a cobrir só a coluna de mensagens, e o header não pisca porque o título já está no cache.
7. **Scroll que gruda no fim.** Usar a lib `use-stick-to-bottom`: segue o stream só quando o usuário está no fim. Se ele rolou pra cima, aparece o botão "Ir para o fim". O scroll não anima a cada token.
8. **Render barato durante o streaming.** Hoje cada token re-renderiza todas as `MessageBubble` e reparseia todo o markdown. Envolver as mensagens concluídas em `React.memo`, com comparação por `id` + `parts.length` + status, para que só a última mensagem renderize no stream (regra React "Memoized Components" do Pro Max).

**Por que React Query e não Server Actions + `updateTag`?** A regra Next.js do Pro Max ("não use `router.refresh()` como estratégia padrão de mutação") aponta para `updateTag` em Server Actions. Só que `updateTag` ainda re-renderiza a árvore RSC do layout, que é justamente o que causa o flash. O chat já vive no cliente (`useChat`), então o estado da lista também fica no cliente. Server Actions podem substituir as rotas `PATCH`/`DELETE` como transporte, mas a UI é atualizada pelo cache.

---

## 4. Fases

Cada fase pode ir pra produção sozinha. A ordem prioriza a dor citada (reloads) e depois o visual.

### Fase 1: Fundação de tokens (~2h)
- [ ] `globals.css`: novos tokens claro/escuro (seção 2.3) e escala tipográfica; raios por hierarquia.
- [ ] `layout.tsx`: trocar Geist por Instrument Sans, Source Serif 4 e JetBrains Mono via `next/font` com `display: swap`.
- [ ] Tema de highlight que acompanha claro/escuro (dois CSS escopados por `.dark`).
- [ ] Bloco global `@media (prefers-reduced-motion: reduce)`.
- [ ] Checar contraste de todos os pares.
- **Pronto quando:** o app inteiro troca de identidade sem mudança de JSX e os testes Playwright continuam passando.

### Fase 2: Fim dos reloads (~4h)
- [ ] React Query: provider, `initialData` da lista, hooks `useConversations` e `useConversation(id)`.
- [ ] Remover os 5 `router.refresh()`.
- [ ] Renomear e apagar otimistas, com toast de desfazer e endpoint de restore.
- [ ] `/title` retorna o título e atualiza o cache.
- [ ] Nova conversa no mesmo `ChatView` + `replaceState`; `/api/chat` cria a conversa; remover `NewChatView` e o autostart.
- [ ] `messageMetadata` com uso e contexto; remover o polling.
- [ ] Route group `(app)` com settings e usage dentro do shell; tirar `force-dynamic` do layout.
- [ ] `use-stick-to-bottom` + botão "Ir para o fim".
- [ ] `React.memo` nas mensagens concluídas (só a última re-renderiza durante o stream).
- **Pronto quando:** num fluxo de nova conversa → 3 mensagens → renomear → apagar → desfazer, a aba Network não mostra nenhum request RSC (`?_rsc=`) além do prefetch de links.

### Fase 3: Conversa e composer (~4h)
- [ ] Separar `MessageBubble` em `UserMessage` (compacta, à direita) e `AssistantMessage` (serif, largura de leitura, sem fundo).
- [ ] Trilha de pesquisa (seção 2.5) no lugar do `ToolCallCard` empilhado, com estado ativo, recolhida e expandida.
- [ ] Estado de espera contextual: "Buscando na web…" / "Lendo página…", derivado da parte de ferramenta ativa, com `aria-live="polite"`.
- [ ] Blocos de código com rótulo de linguagem e botão copiar.
- [ ] Ações da mensagem (copiar, regenerar) sempre visíveis em toque e em `focus-within`, com `aria-label`.
- [ ] Erro inline na mensagem que falhou, com "Tentar de novo" (`regenerate`). O toast fica só pra erros fora do chat.
- [ ] Composer: textarea que cresce até 8 linhas, arrastar e soltar na área do chat, anexos na primeira mensagem, `Esc` pra parar, dica de atalhos fora do placeholder, ícone de arquivo no lugar do emoji 📎.
- [ ] Imagens anexadas abrem em lightbox (Dialog).
- [ ] Estado vazio: sugestões ligadas às ferramentas reais (web, PDF, Drive, notas), cada uma com ícone e verbo.

### Fase 4: Navegação e responsivo (~3h)
- [ ] Trocar a sidebar caseira pelo componente **`Sidebar` do shadcn** (`SidebarProvider` + `SidebarTrigger` + `collapsible="icon"`), conforme a regra shadcn do Pro Max. Isso traz de graça o `Sheet` no mobile, o modo só-ícones de 56px no tablet, o atalho `⌘B` e a persistência do estado em cookie (sem flash no SSR, ao contrário de `localStorage`).
- [ ] Grupos Hoje / Ontem / 7 dias / Mais antigas com `SidebarGroup`; renomear inline com foco visível; item ativo marcado com barra de tinta.
- [ ] Mobile: alvos de toque ≥44px; `h-dvh`; sem scroll horizontal (tabelas markdown com `overflow-x-auto`).
- [ ] ⌘K vira paleta de comandos com o **`Command` do shadcn** (base `cmdk`), usando `CommandGroup` para separar "Conversas" (busca semântica) de "Ações" (nova conversa, configurações, uso, alternar tema, exportar, compartilhar).
- [ ] Header: título editável no lugar; exportar e compartilhar num menu `↗` no mobile.
- [ ] Skip link "Ir para a conversa"; ordem de tab revisada.

### Fase 5: Páginas secundárias (~2h)
- [ ] **Login:** tela com identidade própria, mostrando a trilha de pesquisa como demonstração estática do produto em vez de ícone e texto genérico.
- [ ] **Configurações:** seções com rótulos visíveis; editor de MCP com validação de JSON inline perto do campo; feedback "Salvo" no botão.
- [ ] **Uso:** números em linha (entrada, saída, custo) + barra de cota com marca de 80%, em vez de três cards idênticos.
- [ ] **Share público:** mesma tipografia e trilha, somente leitura, com CTA "Entrar para conversar".
- [ ] **Audit (admin):** tabela densa com filtros no topo e paginação sem recarregar (`useSearchParams` + query).

### Fase 6: Verificação (~1h)
- [ ] Screenshots antes e depois (skill `webapp-testing`/Playwright) em 375, 768, 1024 e 1440px (breakpoints do checklist do Pro Max), temas claro e escuro.
- [ ] Atualizar os 4 testes E2E: o fluxo de nova conversa muda (sem `?autostart`).
- [ ] Novo E2E: renomear, apagar e desfazer sem request RSC.
- [ ] Checklist de entrega do UI/UX Pro Max: contraste, foco visível, toque ≥44px, reduced motion, sem CLS no streaming.

**Total estimado:** ~16h.

---

## 5. Guia de copy

- Verbos diretos, com a ação mantendo o mesmo nome em todo o fluxo: botão "Apagar" → toast "Conversa apagada".
- Erros dizem o que aconteceu e o que fazer: "Limite diário atingido. Volta a liberar às 00h (UTC)." Sem "Ops!" e sem pedir desculpas.
- Estados vazios convidam a agir: "Pergunte algo ou solte um PDF aqui".
- Nomes do ponto de vista do usuário: "Fontes" em vez de "tool invocations", "Conectores" em vez de "MCP config", com o termo técnico em texto de ajuda.

---

## 6. Dependências novas

| Pacote | Uso |
|---|---|
| `@tanstack/react-query` | cache de conversas + mutações otimistas |
| `use-stick-to-bottom` | scroll do streaming |
| shadcn `sidebar`, `sheet`, `command` (traz `cmdk`), `alert-dialog`, `tooltip` | via `npx shadcn add`; sidebar responsiva, ⌘K e confirmação onde o desfazer não se aplica (revogar share) |

---

## 7. Riscos

- **`replaceState` no App Router:** o Next ≥14.1 integra `history.replaceState` ao router. Validar no 16.4 que `usePathname` atualiza e que o "voltar" leva pra conversa anterior, não pra `/c/new`.
- **Criar a conversa dentro do `/api/chat`:** muda a idempotência (`client_message_id` precisa de escopo por usuário quando ainda não existe conversa). Cobrir com teste unitário.
- **Fontes:** três famílias aumentam o payload. Usar subsets `latin`, só os pesos 400 e 600 e a variável do Source Serif.
