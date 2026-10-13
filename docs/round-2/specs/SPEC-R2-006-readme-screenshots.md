# SPEC-R2-006 — Screenshots no README

**Esforço:** ~30min · **Prioridade:** P1

## Objetivo
Primeiro contato do avaliador no GitHub é o README. 4-6 screenshots cronometrados mostram o produto antes mesmo do vídeo rodar.

## Acceptance criteria

- [ ] Screenshots em `docs/screenshots/*.png` commitados
- [ ] README tem seção "Screenshots" entre "Features" e "Stack"
- [ ] Cada screenshot tem legenda curta
- [ ] Imagens em dark mode OU light mode (consistente)
- [ ] Resolução legível (1200-1600px wide), tamanho razoável (<500KB cada)

## Lista de screenshots

| # | Nome | O que mostra |
|---|---|---|
| 1 | `01-chat.png` | Thread com mensagem user + resposta assistant (streaming completo) com markdown + code |
| 2 | `02-vision.png` | Mensagem com imagem anexada + resposta descrevendo |
| 3 | `03-tool-search.png` | Card de tool `web_search` aberto com resultado |
| 4 | `04-mcp.png` | Card de tool `user-notes__save_note` + settings aberto com JSON MCP |
| 5 | `05-share.png` | Modal de share com link + aba anônima mostrando a conversa read-only |
| 6 | `06-audit.png` | Página `/admin/audit` com tabela de eventos |

## Tasks

1. [ ] Rodar app em dark mode (visual mais profissional)
2. [ ] Capturar 6 PNGs com Snipping Tool (`Win+Shift+S`)
3. [ ] Salvar em `docs/screenshots/`
4. [ ] Otimizar tamanho (TinyPNG se >500KB)
5. [ ] Adicionar seção no README com `![legenda](docs/screenshots/01-chat.png)`
6. [ ] Commit + push

## #PATH_DECISION
PNG direto em vez de GIF animado — mais leve, suficiente pro "panorama" (o vídeo cobre interação).
