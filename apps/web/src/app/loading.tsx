export default function GlobalLoading() {
  return (
    <div className="max-w-7xl mx-auto space-y-6" role="status" aria-label="Loading content">
      <div className="h-8 w-64 rounded-md bg-inset animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="nexus-panel p-4 space-y-2">
            <div className="h-3 w-20 rounded bg-inset animate-pulse" />
            <div className="h-7 w-16 rounded bg-inset animate-pulse" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="nexus-panel overflow-hidden">
            <div className="aspect-video bg-inset animate-pulse" />
            <div className="p-4 space-y-2">
              <div className="h-3.5 w-3/4 rounded bg-inset animate-pulse" />
              <div className="h-3 w-1/2 rounded bg-inset animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
