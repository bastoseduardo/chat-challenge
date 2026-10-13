import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Home } from "lucide-react"

export default function ConversationNotFound() {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center space-y-4 max-w-md">
        <h2 className="text-xl font-semibold">Conversa não encontrada</h2>
        <p className="text-sm text-muted-foreground">
          Essa conversa não existe, foi deletada ou pertence a outro usuário.
        </p>
        <Link href="/">
          <Button>
            <Home className="w-4 h-4 mr-2" />
            Ir pra lista
          </Button>
        </Link>
      </div>
    </div>
  )
}
