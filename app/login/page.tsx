"use client"

import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/browser"
import { useState } from "react"
import { MessageSquare } from "lucide-react"

export default function LoginPage() {
  const [loading, setLoading] = useState(false)

  async function signInWithGoogle() {
    setLoading(true)
    const supabase = createClient()
    const origin = window.location.origin
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback`,
      },
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-primary-foreground">
            <MessageSquare className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-semibold">Chat Challenge</h1>
          <p className="text-sm text-muted-foreground">
            Entre com sua conta Google para começar
          </p>
        </div>

        <Button
          className="w-full"
          size="lg"
          onClick={signInWithGoogle}
          disabled={loading}
        >
          {loading ? "Redirecionando..." : "Continuar com Google"}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Ao continuar, você concorda que suas conversas serão persistidas e auditadas.
        </p>
      </div>
    </div>
  )
}
