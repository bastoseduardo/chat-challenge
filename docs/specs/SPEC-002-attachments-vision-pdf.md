# SPEC-002 — Attachments (Vision + PDF)

**User stories:** US-007, US-008, US-009
**Dependências:** SPEC-001
**Estimativa:** ~4h

## Objetivo
Permitir upload de imagens (até 10 MB) e PDFs (até 20 MB), até 5 por mensagem, enviados ao modelo via content parts do AI SDK (vision nativo).

## Acceptance criteria

- [ ] AC-1 UI permite anexar múltiplos arquivos (drag-and-drop + botão).
- [ ] AC-2 Validação client-side de tipo e tamanho (feedback claro).
- [ ] AC-3 Upload vai pra Supabase Storage bucket `chat-attachments`, path `{user_id}/{conv_id}/{uuid}.{ext}`.
- [ ] AC-4 Registro em `attachments` com `storage_path`, `mime_type`, `size_bytes`, `kind`.
- [ ] AC-5 Thumbnails de imagens aparecem no composer antes do envio.
- [ ] AC-6 PDF mostra ícone + nome do arquivo.
- [ ] AC-7 Modelo recebe os anexos como content parts (`type: 'image'` ou `type: 'file'` do AI SDK) e responde baseado no conteúdo.
- [ ] AC-8 Anexos ficam visíveis na mensagem após envio (clicáveis → signed URL abre em nova aba).
- [ ] AC-9 Limites: 10 MB img / 20 MB PDF / 5 anexos por msg.

## Modelo de dados
`attachments` (ver arquitetura).

## Endpoints

| Method | Path | Função |
|---|---|---|
| POST | `/api/attachments/upload` | retorna signed upload URL + cria row em `attachments` |
| GET | `/api/attachments/[id]/url` | signed GET URL (TTL 1h) |

**Fluxo preferencial:** client faz PUT direto pro signed URL (não trafega bytes pelo app).

## Componentes
- `<AttachmentButton/>` — abre file picker
- `<AttachmentPreview/>` — tile com thumb/ícone + remove
- `<MessageAttachments/>` — renderiza na mensagem exibida

## Integração AI SDK

```ts
const content = [
  { type: 'text', text: userMessage.text },
  ...attachments.map(a => a.kind === 'image'
    ? { type: 'image', image: await getSignedUrl(a) }
    : { type: 'file', data: await getSignedUrl(a), mimeType: a.mime_type }
  )
]
```

## Tasks

1. [ ] Criar bucket `chat-attachments` (private) + policy signed URLs
2. [ ] Migration: tabela `attachments` + RLS
3. [ ] API `/api/attachments/upload` → signed PUT URL
4. [ ] API `/api/attachments/[id]/url` → signed GET URL
5. [ ] Composer: multi-file picker + validação
6. [ ] Preview tiles + remove-before-send
7. [ ] Integrar com `/api/chat` → mapear attachment_ids pra content parts
8. [ ] Renderização na mensagem

## Riscos
- **AI SDK/Claude limites de tamanho** → testar PDF 20 MB cedo; se falhar, fallback pra extração de texto (`unpdf`).
- **Signed URL expira durante streaming longo** → gerar URL com TTL >5min pra ingestão do modelo.

## #PATH_DECISION
Upload direto do browser → Storage (signed PUT) economiza bandwidth do app e cumpre o deploy serverless (sem bodies grandes nas routes).
