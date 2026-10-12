import { createServiceClient } from "@/lib/supabase/service"

const BUCKET = "chat-attachments"
const SIGNED_URL_TTL = 60 * 60 // 1h

export const ATTACHMENT_LIMITS = {
  maxPerMessage: 5,
  image: { maxBytes: 10 * 1024 * 1024, mimes: ["image/png", "image/jpeg", "image/webp", "image/gif"] },
  pdf: { maxBytes: 20 * 1024 * 1024, mimes: ["application/pdf"] },
}

export function detectKind(mime: string): "image" | "pdf" | null {
  if (ATTACHMENT_LIMITS.image.mimes.includes(mime)) return "image"
  if (ATTACHMENT_LIMITS.pdf.mimes.includes(mime)) return "pdf"
  return null
}

export async function createSignedUploadUrl(opts: {
  userId: string
  conversationId: string
  mimeType: string
  filename: string
}): Promise<{ path: string; signedUrl: string; token: string }> {
  const supabase = createServiceClient()
  const ext = opts.filename.includes(".") ? opts.filename.split(".").pop() : "bin"
  const path = `${opts.userId}/${opts.conversationId}/${crypto.randomUUID()}.${ext}`
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path)
  if (error || !data) throw new Error(error?.message ?? "signed_url_failed")
  return { path, signedUrl: data.signedUrl, token: data.token }
}

export async function createSignedDownloadUrl(storagePath: string): Promise<string> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL)
  if (error || !data) throw new Error(error?.message ?? "signed_url_failed")
  return data.signedUrl
}

export async function downloadAttachment(
  storagePath: string
): Promise<{ data: ArrayBuffer; mimeType: string }> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath)
  if (error || !data) throw new Error(error?.message ?? "download_failed")
  return { data: await data.arrayBuffer(), mimeType: data.type }
}
