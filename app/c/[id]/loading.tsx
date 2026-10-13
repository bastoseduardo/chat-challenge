export default function ChatLoading() {
  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b h-14 shrink-0 px-6 flex items-center">
        <div className="h-5 w-40 bg-muted rounded animate-pulse" />
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={`flex gap-3 ${i % 2 === 0 ? "" : "justify-end"}`}
            >
              <div
                className={`h-16 rounded-lg bg-muted animate-pulse ${
                  i % 2 === 0 ? "w-2/3" : "w-1/2"
                }`}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
