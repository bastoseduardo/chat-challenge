export default function AuditLoading() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <div className="h-8 w-40 bg-muted rounded animate-pulse" />
      <div className="h-10 w-full bg-muted rounded animate-pulse" />
      <div className="border rounded-lg overflow-hidden">
        <div className="h-10 bg-muted animate-pulse" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-10 border-t animate-pulse"
            style={{ opacity: 0.5 - i * 0.04 }}
          />
        ))}
      </div>
    </div>
  )
}
