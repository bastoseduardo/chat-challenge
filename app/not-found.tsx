import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Home } from "lucide-react"

export default function NotFound() {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center space-y-4 max-w-md">
        <h1 className="text-5xl font-bold">404</h1>
        <h2 className="text-xl font-semibold">Página não encontrada</h2>
        <p className="text-sm text-muted-foreground">
          O recurso que você tentou acessar não existe ou foi removido.
        </p>
        <Link href="/">
          <Button>
            <Home className="w-4 h-4 mr-2" />
            Voltar ao início
          </Button>
        </Link>
      </div>
    </div>
  )
}
