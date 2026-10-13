"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw, Home } from "lucide-react"
import Link from "next/link"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[global-error]", error)
  }, [error])

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center space-y-4 max-w-md">
        <h1 className="text-5xl font-bold">500</h1>
        <h2 className="text-xl font-semibold">Algo deu errado</h2>
        <p className="text-sm text-muted-foreground">
          {error.message || "Erro inesperado no servidor."}
          {error.digest && (
            <span className="block mt-2 font-mono text-xs opacity-50">
              digest: {error.digest}
            </span>
          )}
        </p>
        <div className="flex gap-2 justify-center">
          <Button onClick={reset}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Tentar novamente
          </Button>
          <Link href="/">
            <Button variant="outline">
              <Home className="w-4 h-4 mr-2" />
              Início
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
