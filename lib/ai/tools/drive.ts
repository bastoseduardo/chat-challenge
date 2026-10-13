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

  const searchFiles = tool({
    description:
      "Busca arquivos no Google Drive do usuário. Retorna até 10 resultados com id, nome e tipo.",
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          "Termo de busca. Será usado como 'name contains \"<query>\"' na API do Drive."
        ),
      max_results: z.number().int().min(1).max(20).optional().default(10),
    }),
    execute: async ({ query, max_results }) => {
      try {
        const q = encodeURIComponent(`name contains '${query.replace(/'/g, "\\'")}' and trashed = false`)
        const url =
          `https://www.googleapis.com/drive/v3/files?q=${q}` +
          `&pageSize=${max_results}` +
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
          query,
          files:
            data.files?.map((f) => ({
              id: f.id,
              name: f.name,
              mimeType: f.mimeType,
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
