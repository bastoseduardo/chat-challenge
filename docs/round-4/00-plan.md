# Round 4: diferenciais do produto

**Data:** 2026-10-15
**Contexto:** portfólio e entrevista. Quem usa: o autor e os avaliadores. O feedback recebido pediu melhoria; o Round 3 resolveu interface e reloads. Este round dá ao Seshat um motivo pra ser escolhido.

---

## 1. Posicionamento

> **Seshat é o assistente de pesquisa pra quem precisa confiar no que encontrou e reaproveitar depois.**

Três promessas, cada uma virando uma aposta deste round:

| Promessa | Hoje | Depois deste round |
|---|---|---|
| "Mostra de onde veio" | A trilha mostra o que foi consultado, mas o texto não diz qual frase veio de qual fonte | Cada afirmação tem marcação [n] ligada à fonte, com o trecho citado e a página do PDF |
| "Guarda pra você" | Notas existem, mas escondidas atrás do MCP | Caderno visível: guardar um trecho com 1 clique, notas viram contexto das próximas conversas |
| "Dá pra mostrar pros outros" | Link de compartilhamento mostra a conversa crua | Link vira relatório: resumo, fontes e PDF |

**Critério de sucesso do round:** um avaliador, em até 3 minutos e sem explicação, vê uma resposta com fontes clicáveis, guarda um trecho no Caderno e abre o relatório compartilhado (seção 9).

### O que fica fora

Agentes autônomos, mais modelos no seletor e plugins genéricos competem com os grandes no terreno deles e diluem a promessa. Pesquisa recorrente (monitorar um tema toda semana) fica como ideia futura (seção 10).

---

## 2. Fatos técnicos que guiam o desenho

Verificado no código e no `@ai-sdk/anthropic@4.0.79` instalado:

1. **Resposta salva só como texto.** `onFinish` do `/api/chat` grava `content: [{ type: "text", text }]`. As chamadas de ferramenta vão pra `tool_invocations` e são remontadas pela UI. Partes `source` (citações) **não são salvas**: ao recarregar, as citações sumiriam.
2. **Citações de PDF nativas.** A API da Anthropic aceita `citations: { enabled: true }` em blocos `document`; a resposta traz `cited_text` + `page_location` (página inicial/final). O AI SDK expõe isso como `providerOptions.anthropic.citations` no file part e converte cada citação numa parte `source` (`sourceType: "document"`, `providerMetadata.anthropic.citedText/startPageNumber/endPageNumber`).
3. **Busca na web nativa com citações.** O provider já traz `webSearch_20260209` e `webFetch_20260209` (busca e leitura executadas pela Anthropic; citações sempre ligadas na busca, opcionais na leitura). Saem partes `source` do tipo URL. Hoje o app usa Tavily + Jina, que devolvem JSON e não geram citações.
4. **pgvector já existe** (Voyage `voyage-3-lite`, dim 512, índice HNSW) para mensagens. Notas (`user_notes`) ainda não têm embedding, nem vínculo com mensagem ou fonte.
5. **Login pede `drive.readonly` logo na entrada.** É escopo sensível. *Confirmado em 2026-10-15: os emails dos avaliadores estão cadastrados como usuários de teste no app OAuth, então não é urgente.* Vira melhoria de baixa prioridade (SPEC-R4-011).

---

## 3. Fase 0: Fundação, salvar a resposta inteira (~0,5 dia)

Pré-requisito das citações e do relatório.

- [ ] No `/api/chat`, persistir a `UIMessage` final completa (texto + partes de ferramenta + `source`) usando o `onFinish` de `toUIMessageStreamResponse` (recebe a mensagem de resposta montada), em vez de só o texto.
- [ ] `listMessagesWithAttachments`: se a mensagem já tem parts completas, usar direto; senão (mensagens antigas), manter a remontagem a partir de `tool_invocations`. Sem migração de dados.
- [ ] `tool_invocations` continua sendo gravada (audit e métricas não mudam).
- [ ] `buildContext` continua mandando só texto pro modelo (sem regressão de custo).
- **Pronto quando:** recarregar a página mostra exatamente as mesmas partes do stream, inclusive `source`.

---

## 4. Fase 1: Citações (~2,5 dias)

### 4.1 Spike de 2h antes de tudo
Validar com um script isolado, com `claude-sonnet-4-6` (modelo padrão do app):
- se o texto vem dividido em várias partes com `source` intercaladas (dá pra saber **qual frase** cada fonte sustenta) ou se as fontes chegam agrupadas no fim;
- custo e latência da busca nativa contra Tavily, em 5 perguntas reais.

**Decisão que sai do spike:**
- **A (preferida):** busca e leitura nativas da Anthropic. Citações vêm prontas e sem parser próprio. Tavily/Jina ficam desligadas por padrão.
- **B (plano B):** manter Tavily/Jina, numerar os resultados na saída da ferramenta (`ref: 1..n` por turno) e instruir o modelo a citar `[n]`; o cliente casa `[n]` com a fonte.

### 4.2 Implementação
- [ ] **PDF:** em `buildContext`, anexos PDF vão com `providerOptions: { anthropic: { citations: { enabled: true } } }` e título = nome do arquivo.
- [ ] **Web:** conforme o spike (A ou B). Em A, a trilha passa a mostrar as ferramentas nativas ("Buscou na web…", "Leu dominio.com") com o mesmo componente.
- [ ] **Marcações no texto:** `AssistantMessage` renderiza `[1]`, `[2]` sobrescritos depois do trecho citado. Fontes repetidas reaproveitam o número.
- [ ] **Cartão da fonte** (hover no desktop, toque no mobile): título, domínio ou "PDF, p. 12", o **trecho citado** entre aspas, link "Abrir fonte". Acessível por teclado (botão + popover).
- [ ] **Bloco "Fontes"** no fim da resposta: lista numerada; recolhida quando há mais de 3.
- [ ] **Ligação com a trilha:** passar o mouse num passo da trilha destaca as marcações que vieram dele, e vice-versa. É o "momento memorável" da demo.
- [ ] **Sinal de confiança** (leve, sem prometer o que não mede): no rodapé, "3 fontes, a mais recente de out/2026" ou "Sem fontes externas, resposta do conhecimento do modelo".
- [ ] **Instrução de sistema:** ao usar ferramentas, apoiar afirmações factuais em fontes; quando não houver, dizer.
- [ ] Copiar resposta e exportar Markdown incluem as fontes como notas de rodapé.
- **Pronto quando:** uma pergunta factual com busca e uma pergunta sobre um PDF anexado mostram marcações clicáveis com trecho e página, e continuam lá depois de recarregar.

---

## 5. Fase 2: Caderno (~2,5 dias)

### 5.1 Dados
- [ ] `user_notes` ganha: `title`, `quote` (trecho guardado), `source_url`, `source_title`, `source_page`, `conversation_id`, `message_id`, `embedding vector(512)`, `updated_at`. Migração aditiva; notas antigas seguem válidas.
- [ ] Embedding gerado em background (`after()`), como já é feito nas mensagens.

### 5.2 Interface
- [ ] **"Caderno" na sidebar**, entre as conversas e Uso. Rota `/caderno` dentro do shell.
- [ ] **Lista** com busca (texto e significado), filtro por conversa de origem, editar e apagar com "Desfazer" (mesmo padrão da sidebar).
- [ ] **Guardar a partir da resposta:**
  - selecionar texto numa resposta mostra um botão flutuante "Guardar no caderno" (leva o trecho e a fonte citada mais próxima, se houver);
  - nas ações da resposta, "Guardar resposta".
  - Toast "Guardado no caderno", com "Abrir".
- [ ] **Cada nota mostra de onde veio:** link pra conversa e mensagem (`#msg-<id>`, já existe) e pra fonte original.

### 5.3 Notas como contexto
- [ ] A cada mensagem, buscar as 3 notas mais parecidas (pgvector, limiar de similaridade) e enviar como contexto marcado ("Notas do usuário relevantes: …").
- [ ] A trilha ganha um passo **"Consultou 2 notas do caderno"** (data part emitido pelo servidor), clicável para ver quais.
- [ ] Interruptor em Configurações: "Usar o caderno como contexto" (ligado por padrão).
- [ ] As ferramentas MCP `save_note` / `search_notes` passam a usar a mesma tabela e o mesmo embedding: notas salvas pelo chat aparecem no Caderno.
- [ ] Ctrl+K ganha o grupo "No caderno".
- **Pronto quando:** guardar um trecho numa conversa e, numa conversa nova, perguntar algo relacionado mostra "Consultou 1 nota do caderno" e a resposta usa a nota.

---

## 6. Fase 3: Compartilhar como relatório (~1,5 dia)

- [ ] Ao compartilhar, gerar um **resumo** da conversa (3 a 5 frases + conclusões) e salvar em `shares.summary`. "Gerar de novo" no diálogo de compartilhar.
- [ ] Página `/share/[token]` em formato de relatório:
  - título, data e "Pesquisado com Seshat";
  - **Resumo** no topo;
  - conversa com as citações e a trilha (componentes reais, somente leitura);
  - **Fontes consultadas** agregadas no fim, numeradas e com link.
- [ ] **"Baixar PDF"** via CSS de impressão (`@media print`: sem sidebar e botões, quebras de página nas mensagens) + `window.print()`. Sem biblioteca de PDF no servidor.
- [ ] Metadata Open Graph (título + resumo), pra o link ficar bom colado no WhatsApp ou no Slack.
- **Pronto quando:** o link aberto deslogado parece um documento, e o PDF impresso tem resumo, conversa e fontes.

---

## 7. Fase 4: O básico que falta (~1,5 dia)

- [ ] **Editar e reenviar** uma mensagem do usuário: lápis na mensagem, edita no lugar, reenvia. Servidor apaga (soft) as mensagens seguintes. Bloqueado antes do último resumo de compactação, com aviso.
- [ ] **Modelo na resposta:** rodapé discreto "Sonnet 4.6" (o campo `messages.model` já existe).
- [ ] **Ditado por voz** no composer (Web Speech API, `pt-BR`); o botão só aparece se o navegador suportar.
- [ ] **Login sem pedir o Drive:** entrar só com email e perfil. Pedir `drive.readonly` só quando o usuário liga uma ferramenta do Drive em Configurações (autorização incremental: novo `signInWithOAuth` com o escopo extra). Resolve o problema do item 2.5.

---

## 8. Fase 5: Primeira experiência dos avaliadores (~1 dia)

O avaliador entra numa conta vazia e decide em minutos. Essa fase é a que mais pesa no resultado.

- [x] **App OAuth do Google:** avaliadores cadastrados como usuários de teste (confirmado).
- [ ] **Tela de boas-vindas** quando o usuário não tem conversas: uma frase do que o Seshat faz + botão **"Ver uma pesquisa de exemplo"**, que dispara uma pergunta curada (busca na web + citação + sugestão de guardar no caderno). Roda de verdade, não é vídeo.
- [ ] **"O que observar"**: painel lateral pequeno e dispensável, com 4 itens marcáveis (fontes [n], trilha, guardar no caderno, compartilhar como relatório). Some quando os 4 são vistos ou ao dispensar.
- [ ] **Roteiro de 3 minutos** no README (seção 9) e GIF curto no topo do README.
- [ ] Cotas: confirmar que `USER_DAILY_TOKEN_CAP` comporta a demo com folga para vários avaliadores.

---

## 9. Roteiro de demonstração (3 minutos)

1. Entrar com Google (sem tela de permissão do Drive).
2. "Ver uma pesquisa de exemplo": a trilha anda ao vivo; a resposta chega com [1] [2].
3. Passar o mouse em [1]: trecho citado e fonte. Passar na trilha: as marcações dela acendem.
4. Selecionar uma frase e guardar no caderno.
5. Nova conversa, pergunta relacionada: "Consultou 1 nota do caderno".
6. Anexar um PDF e perguntar: citação com "p. 4".
7. Compartilhar: abrir o link como relatório e baixar o PDF.

---

## 10. Fase 6 (estica): Espaços de pesquisa (~3 dias)

Só depois das fases 0 a 5 estarem redondas.

- [ ] Entidade `projects` (nome, descrição) e `project_sources` (PDFs já enviados, links). Conversas podem pertencer a um projeto.
- [ ] Abordagem pragmática pro tamanho do uso (portfólio): as fontes do projeto entram como documentos com citações em **toda** conversa do projeto, com **prompt caching** no prefixo (fontes estáveis primeiro). Limite de ~10 documentos ou ~300 páginas por projeto. Sem pipeline de chunking próprio.
- [ ] Sidebar agrupa conversas por projeto; cabeçalho do projeto lista as fontes.
- **Ideia futura (fora do round):** pesquisa recorrente ("acompanhe este tema toda segunda", com o cron que já existe e destaque do que mudou).

---

## 11. Riscos

| Risco | Mitigação |
|---|---|
| Citações nativas não indicam bem qual frase cada fonte sustenta | Spike da Fase 1 decide entre A e B antes de construir a UI |
| Custo da busca nativa (cobrada por busca) | Volume de portfólio é baixo; `max_uses` por turno; medir no spike |
| Persistir parts completos aumenta o tamanho das mensagens | Truncar `output` de ferramentas grandes (ex.: página lida) ao salvar; o texto citado já vem nas partes `source` |
| Notas irrelevantes injetadas no contexto | Limiar de similaridade + no máximo 3 + passo visível na trilha + interruptor |
| Editar mensagem conflita com a compactação | Bloquear edição antes do último resumo |
| Avaliador barrado no OAuth | Fase 4 (escopos incrementais) + conferência do app na Fase 5 |
| Prazo | Ordem por impacto na demo: 0 → 1 → 5 → 2 → 3 → 4 → 6. Cada fase vai pra produção sozinha |

---

## 12. Estimativa e ordem

| Ordem | Fase | Esforço |
|---|---|---|
| 1 | 0. Salvar a resposta inteira | 0,5 dia |
| 2 | 1. Citações | 2,5 dias |
| 3 | 5. Primeira experiência | 1 dia |
| 4 | 2. Caderno | 2,5 dias |
| 5 | 3. Relatório compartilhável | 1,5 dia |
| 6 | 4. Básicos restantes | 1 dia |
| 7 | 6. Espaços (estica) | 3 dias |

**Total sem a estica:** ~9 dias. Specs e tasks executáveis em `docs/round-4/specs/` e `docs/round-4/tasks.md`. Mesmo processo do Round 3: branch própria, validação em dev com o dev-login, commit por fase, push só quando pedido.
