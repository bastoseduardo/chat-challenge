import { tool } from "ai"
import { z } from "zod"
import type { ToolSet } from "ai"

const MAX_CONTENT_LENGTH = 20_000

interface DriveFile {
  id: string
  name: string
  mimeType: string
  modifiedTime?: string
}

function unauthorizedResult() {
  return {
    error:
      "Autorização expirada ou escopo faltando. Faça logout e login novamente para reautorizar o acesso ao Google Drive.",
  }
}

/**
 * Constrói as tools do Drive com closure sobre o provider_token.
 * Retorna um ToolSet vazio se não houver token (user não consentiu).
 */
export function buildDriveTools(opts: { providerToken: string | null }): ToolSet {
  if (!opts.providerToken) return {}
  const token = opts.providerToken

  const FOLDER_MIME = "application/vnd.google-apps.folder"

  function labelKind(mimeType: string): string {
    if (mimeType === FOLDER_MIME) return "folder"
    if (mimeType === "application/vnd.google-apps.document") return "google-doc"
    if (mimeType === "application/vnd.google-apps.spreadsheet") return "google-sheet"
    if (mimeType === "application/vnd.google-apps.presentation") return "google-slides"
    if (mimeType === "application/pdf") return "pdf"
    if (mimeType.startsWith("image/")) return "image"
    if (mimeType.startsWith("text/")) return "text"
    return mimeType
  }

  const searchFiles = tool({
    description:
      "Busca ou lista arquivos e pastas no Google Drive do usuário. " +
      "Use `query` para busca por nome, ou `folder_id` para listar conteúdo de uma pasta. " +
      "Sem argumentos retorna os arquivos modificados mais recentemente. " +
      "Resultados incluem pastas (kind='folder') — use o id da pasta como folder_id para explorar dentro.",
    inputSchema: z.object({
      query: z
        .string()
        .optional()
        .describe(
          "Opcional. Termo de busca por nome ('name contains'). Omita para listar recentes."
        ),
      folder_id: z
        .string()
        .optional()
        .describe(
          "Opcional. Lista arquivos filhos desta pasta. Mutuamente exclusivo com `query`."
        ),
      max_results: z.number().int().min(1).max(50).optional().default(20),
      only_files: z
        .boolean()
        .optional()
        .default(false)
        .describe("Se true, exclui pastas dos resultados."),
    }),
    execute: async ({ query, folder_id, max_results, only_files }) => {
      try {
        const clauses: string[] = ["trashed = false"]
        if (folder_id) {
          clauses.push(`'${folder_id.replace(/'/g, "\\'")}' in parents`)
        } else if (query) {
          clauses.push(`name contains '${query.replace(/'/g, "\\'")}'`)
        }
        if (only_files) {
          clauses.push(`mimeType != '${FOLDER_MIME}'`)
        }
        const q = encodeURIComponent(clauses.join(" and "))
        const url =
          `https://www.googleapis.com/drive/v3/files?q=${q}` +
          `&pageSize=${max_results}` +
          `&orderBy=modifiedTime desc` +
          `&fields=files(id,name,mimeType,modifiedTime)`
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.status === 401) return unauthorizedResult()
        if (!res.ok) {
          const detail = await res.text().catch(() => "")
          return { error: `Drive API ${res.status}: ${detail.slice(0, 200)}` }
        }
        const data = (await res.json()) as { files?: DriveFile[] }
        return {
          query: query ?? null,
          folder_id: folder_id ?? null,
          files:
            data.files?.map((f) => ({
              id: f.id,
              name: f.name,
              mimeType: f.mimeType,
              kind: labelKind(f.mimeType),
              modifiedTime: f.modifiedTime,
            })) ?? [],
        }
      } catch (err) {
        return {
          error: err instanceof Error ? err.message : "unknown",
        }
      }
    },
  })

  const readFile = tool({
    description:
      "Lê o conteúdo de um arquivo do Google Drive. Para Google Docs/Sheets, retorna texto exportado. Binários (imagens, zip) não são suportados.",
    inputSchema: z.object({
      fileId: z.string().describe("ID do arquivo (obtido de drive_search_files)"),
    }),
    execute: async ({ fileId }) => {
      try {
        // Primeiro pega o mimeType
        const metaRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        if (metaRes.status === 401) return unauthorizedResult()
        if (!metaRes.ok) {
          return { error: `Drive API ${metaRes.status}` }
        }
        const meta = (await metaRes.json()) as DriveFile

        const exportMap: Record<string, string> = {
          "application/vnd.google-apps.document": "text/plain",
          "application/vnd.google-apps.spreadsheet": "text/csv",
          "application/vnd.google-apps.presentation": "text/plain",
        }

        let contentUrl: string
        if (exportMap[meta.mimeType]) {
          contentUrl =
            `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export` +
            `?mimeType=${encodeURIComponent(exportMap[meta.mimeType])}`
        } else if (
          meta.mimeType.startsWith("text/") ||
          meta.mimeType === "application/json"
        ) {
          contentUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`
        } else {
          return {
            error: `Tipo não suportado: ${meta.mimeType}. Suporta apenas Google Docs/Sheets/Slides e arquivos de texto.`,
            file: meta,
          }
        }

        const contentRes = await fetch(contentUrl, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (contentRes.status === 401) return unauthorizedResult()
        if (!contentRes.ok) {
          return { error: `Drive API ${contentRes.status}` }
        }
        const text = await contentRes.text()
        return {
          file: { id: meta.id, name: meta.name, mimeType: meta.mimeType },
          content: text.slice(0, MAX_CONTENT_LENGTH),
          truncated: text.length > MAX_CONTENT_LENGTH,
        }
      } catch (err) {
        return { error: err instanceof Error ? err.message : "unknown" }
      }
    },
  })

  return {
    drive_search_files: searchFiles,
    drive_read_file: readFile,
  }
}
