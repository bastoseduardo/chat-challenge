"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

export function ImageLightbox({
  src,
  alt,
  className,
}: {
  src: string
  alt: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn("block overflow-hidden rounded-md cursor-zoom-in", className)}
        aria-label={alt ? `Ampliar ${alt}` : "Ampliar imagem"}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="max-h-64 max-w-full object-contain" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[min(92vw,1100px)] p-2 sm:p-3">
          <DialogTitle className="sr-only">{alt || "Imagem anexada"}</DialogTitle>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="max-h-[85vh] w-full object-contain" />
        </DialogContent>
      </Dialog>
    </>
  )
}
