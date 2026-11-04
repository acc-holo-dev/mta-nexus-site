import { getRequestLocale } from "../../../../../../lib/i18n-server";
import { libraryCollectionComparisonCopy } from "../../../../../../lib/library-collection-comparison-i18n";

// Honest loading shell for /workspace/library/collections/[id]/compare.
export default async function Loading() {
  const copy = libraryCollectionComparisonCopy(await getRequestLocale());
  return (
    <section
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      aria-busy="true"
      aria-labelledby="collection-compare-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="collection-compare-loading-heading" className="font-display text-primary">
          {copy.title}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {copy.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-10 w-72 rounded bg-inset" />
        <div className="h-24 rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
