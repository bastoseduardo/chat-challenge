"use client"

import { useCallback, useState } from "react"
import { toast } from "sonner"

export interface PendingAttachment {
  id: string // local id (uuid)
  kind: "image" | "pdf"
  mimeType: string
  sizeBytes: number
  originalName: string
  storagePath?: string
  previewUrl?: string
  status: "uploading" | "ready" | "error"
}

const IMAGE_MIMES = ["image/png", "image/jpeg", "image/webp", "image/gif"]
const PDF_MIMES = ["application/pdf"]
const MAX_IMAGE = 10 * 1024 * 1024
const MAX_PDF = 20 * 1024 * 1024
const MAX_PER_MESSAGE = 5

function detect(mime: string): "image" | "pdf" | null {
  if (IMAGE_MIMES.includes(mime)) return "image"
  if (PDF_MIMES.includes(mime)) return "pdf"
  return null
}

export function useAttachments(conversationId: string) {
  const [items, setItems] = useState<PendingAttachment[]>([])

  const add = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files)
      if (items.length + arr.length > MAX_PER_MESSAGE) {
        toast.error(`Máximo ${MAX_PER_MESSAGE} anexos por mensagem`)
        return
      }
      for (const file of arr) {
        const kind = detect(file.type)
        if (!kind) {
          toast.error(`${file.name}: tipo não suportado`)
          continue
        }
        const limit = kind === "image" ? MAX_IMAGE : MAX_PDF
        if (file.size > limit) {
          toast.error(`${file.name}: excede ${limit / 1024 / 1024}MB`)
          continue
        }
        const localId = crypto.randomUUID()
        const previewUrl = kind === "image" ? URL.createObjectURL(file) : undefined
        setItems((prev) => [
          ...prev,
          {
            id: localId,
            kind,
            mimeType: file.type,
            sizeBytes: file.size,
            originalName: file.name,
            previewUrl,
            status: "uploading",
          },
        ])
        try {
          const res = await fetch("/api/attachments/upload", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              conversationId,
              mimeType: file.type,
              sizeBytes: file.size,
              originalName: file.name,
            }),
          })
          if (!res.ok) throw new Error("upload prep failed")
          const data = (await res.json()) as {
            signedUrl: string
            storagePath: string
          }
          const put = await fetch(data.signedUrl, {
            method: "PUT",
            headers: { "content-type": file.type },
            body: file,
          })
          if (!put.ok) throw new Error("upload failed")
          setItems((prev) =>
            prev.map((it) =>
              it.id === localId
                ? { ...it, storagePath: data.storagePath, status: "ready" }
                : it
            )
          )
        } catch (err) {
          console.error(err)
          toast.error(`Erro ao enviar ${file.name}`)
          setItems((prev) =>
            prev.map((it) => (it.id === localId ? { ...it, status: "error" } : it))
          )
        }
      }
    },
    [conversationId, items.length]
  )

  const remove = useCallback((id: string) => {
    setItems((prev) => {
      const found = prev.find((it) => it.id === id)
      if (found?.previewUrl) URL.revokeObjectURL(found.previewUrl)
      return prev.filter((it) => it.id !== id)
    })
  }, [])

  const reset = useCallback(() => {
    setItems((prev) => {
      prev.forEach((it) => it.previewUrl && URL.revokeObjectURL(it.previewUrl))
      return []
    })
  }, [])

  const ready = items.filter((it) => it.status === "ready" && it.storagePath)
  const isUploading = items.some((it) => it.status === "uploading")

  return { items, add, remove, reset, ready, isUploading }
}
