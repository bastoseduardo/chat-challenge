"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { ChatView } from "./chat-view"

// Depois do primeiro envio o ChatView troca a URL pra /c/<id> via
// history.replaceState, sem desmontar. Se o usuário pedir outra conversa nova
// (/c/new de novo), o React pode reaproveitar a mesma instância — a key
// força um ChatView zerado, com um id novo.
export function NewChat() {
  const pathname = usePathname()
  const [prevPathname, setPrevPathname] = useState(pathname)
  const [instance, setInstance] = useState(0)

  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    if (pathname === "/c/new") setInstance((n) => n + 1)
  }

  return <ChatView key={instance} />
}
