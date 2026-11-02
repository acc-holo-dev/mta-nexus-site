import { getRequestLocale } from "../../../../../lib/i18n-server";
import { libraryCollectionsCopy } from "../../../../../lib/library-collections-i18n";

// Honest loading shell for /workspace/library/collections/[id].
export default async function Loading() {
  const copy = libraryCollectionsCopy(await getRequestLocale());
  return (
    <section
      className="mx-auto max-w-4xl space-y-6"
      aria-busy="true"
      aria-labelledby="library-collection-detail-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="library-collection-detail-loading-heading" className="font-display text-primary">
          {copy.title}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {copy.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-28 rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
