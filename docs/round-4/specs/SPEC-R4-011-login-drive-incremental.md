# SPEC-R4-011: Login sem pedir o Drive

**Esforço:** ~0,5 dia · **Prioridade:** P3 (não urgente: avaliadores já são usuários de teste) · **Depende de:** — · **Pode rodar junto com:** qualquer · **Tasks:** R4111–R4113

## Objetivo
Entrar só com email e perfil; pedir acesso ao Drive apenas quando o usuário liga uma ferramenta do Drive. Reduz a fricção do consentimento e prepara o app pra sair do modo de teste no futuro.

## Contexto
- `app/login/page.tsx`: `signInWithOAuth({ provider: "google", options: { scopes: "https://www.googleapis.com/auth/drive.readonly" } })`.
- `/api/chat` lê `session.provider_token` pro Drive.
- Configurações: `components/settings/settings-form.tsx` (switches das ferramentas).

## Escopo
1. Login sem o escopo do Drive.
2. Ao ligar "Buscar no Google Drive" ou "Ler arquivos do Google Drive" sem token com o escopo: explicar ("O Seshat vai pedir ao Google permissão só de leitura no seu Drive") e chamar `signInWithOAuth` com o escopo extra + `queryParams: { include_granted_scopes: "true", prompt: "consent" }` e `redirectTo` de volta pra `/settings`.
3. Ferramenta do Drive executada sem token: retorno amigável ("O Drive não está conectado. Ligue em Configurações.") em vez de erro técnico.

## Acceptance criteria
- [ ] Login novo não mostra a tela de permissão do Drive.
- [ ] Ligar a ferramenta pede a permissão e volta pra Configurações com a ferramenta ativa.
- [ ] Sem permissão, a trilha mostra o passo com a mensagem amigável.

## Observação
Testar com uma conta Google cadastrada como usuária de teste que ainda não autorizou o app (ou revogar em myaccount.google.com/permissions).
