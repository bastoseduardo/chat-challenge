import { AppHeader } from "@/components/app-header"

export default function CadernoLoading() {
  return (
    <>
      <AppHeader title={<h1 className="truncate px-1 font-semibold">Caderno</h1>} />
      <div className="flex-1 overflow-y-auto" aria-busy="true">
        <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6 sm:px-6">
          <div className="h-10 w-full rounded-md bg-muted animate-pulse" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 w-full rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    </>
  )
}
