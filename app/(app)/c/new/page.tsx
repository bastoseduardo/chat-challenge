import { NewChat } from "@/components/chat/new-chat"

export const metadata = { title: "Nova conversa" }

export default async function NewChatPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>
}) {
  // `?welcome=1` mostra as boas-vindas mesmo com conversas (só em dev, pra
  // validar com a conta do autor).
  const forceWelcome = process.env.NODE_ENV === "development" && (await searchParams).welcome === "1"
  return <NewChat forceWelcome={forceWelcome} />
}
