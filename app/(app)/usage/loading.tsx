import { AppHeader } from "@/components/app-header"

export default function UsageLoading() {
  return (
    <>
    <AppHeader title={<div className="h-5 w-32 rounded bg-muted animate-pulse" />} />
    <div className="flex-1 overflow-y-auto"><div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <div className="h-8 w-48 bg-muted rounded animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
      <div className="h-28 bg-muted rounded-lg animate-pulse" />
    </div></div>
    </>
  )
}
