import { AppHeader } from "@/components/app-header"

export default function UsageLoading() {
  return (
    <>
      <AppHeader title={<h1 className="truncate px-1 font-semibold">Uso de hoje</h1>} />
      <div className="flex-1 overflow-y-auto" aria-busy="true">
        <div className="mx-auto w-full max-w-3xl space-y-10 px-4 py-8 sm:px-6">
          <div className="space-y-4">
            <div className="h-8 w-72 rounded bg-muted animate-pulse" />
            <div className="h-2.5 w-full rounded-full bg-muted animate-pulse" />
            <div className="h-4 w-56 rounded bg-muted animate-pulse" />
          </div>
          <div className="h-20 w-full rounded-lg bg-muted animate-pulse" />
        </div>
      </div>
    </>
  )
}
