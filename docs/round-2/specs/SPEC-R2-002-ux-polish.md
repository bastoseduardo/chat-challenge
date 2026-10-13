# SPEC-R2-002 — UX Polish

**Esforço:** ~2h · **Prioridade:** P0

Agrupamento de 3 melhorias de UX: empty states + loading, páginas de erro, dark mode toggle, quota modal.

## Acceptance criteria

- [ ] Sidebar vazia tem call-to-action "Nova conversa"
- [ ] Chat vazio tem exemplos de perguntas sugeridas (chips clicáveis)
- [ ] Loading states com skeletons nas páginas `/usage` e `/admin/audit`
- [ ] Página `not-found.tsx` global + específica da conversa
- [ ] Página `error.tsx` global com botão "Tentar novamente"
- [ ] Dark mode toggle no footer da sidebar (next-themes)
- [ ] Sem flash of unstyled content (FOUC) no toggle
- [ ] Modal "quota exceeded" vem com botão "Ver meu uso" → `/usage`
- [ ] Toast de erro genérico (`sonner`) usado em todas as mutations do cliente

## Tasks

### Empty states
1. [ ] Sidebar: ao ter 0 conversas, mostra ícone + CTA de "Começar"
2. [ ] ChatView empty: 4 chips de prompt (ex.: "Me pesquisa X", "Resume este PDF", "Salve na minha nota: Y", "Qual o horário em Lisboa?")

### Loading / Skeletons
3. [ ] `app/usage/loading.tsx` — skeleton do dashboard
4. [ ] `app/admin/audit/loading.tsx` — skeleton da tabela
5. [ ] `app/c/[id]/loading.tsx` — skeleton do chat

### Error / Not found
6. [ ] `app/not-found.tsx` global com link pra home
7. [ ] `app/c/[id]/not-found.tsx` — "conversa não existe"
8. [ ] `app/share/[token]/not-found.tsx` — "share revogado ou inválido"
9. [ ] `app/error.tsx` client component com reset

### Dark mode
10. [ ] `components/theme/provider.tsx` — `next-themes` ThemeProvider
11. [ ] Injetar no `app/layout.tsx` (`attribute="class"`, `defaultTheme="system"`, `disableTransitionOnChange`)
12. [ ] `components/theme/toggle.tsx` — toggle sol/lua
13. [ ] Adicionar no footer da sidebar
14. [ ] `suppressHydrationWarning` no `<html>`

### Quota modal
15. [ ] Em `ChatView`, detectar erro 429 e abrir dialog
16. [ ] Dialog com texto + botão "Ver meu uso" (link pra `/usage`)

## #PATH_DECISION
`next-themes` já estava instalado por shadcn/sonner — zero deps novas. Dark mode via `class` em `<html>` + CSS vars já alinhados (globals.css tem `.dark { ... }`).
