import { Suspense } from "react"
import { AppHeader } from "@/components/app-header"
import { NotesList } from "@/components/notes/notes-list"

export const metadata = { title: "Caderno" }

export default function CadernoPage() {
  return (
    <>
      <AppHeader title={<h1 className="truncate px-1 font-semibold">Caderno</h1>} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
          {/* useSearchParams (filtro por conversa) exige Suspense */}
          <Suspense>
            <NotesList />
          </Suspense>
        </div>
      </div>
    </>
  )
}
