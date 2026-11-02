import { getRequestLocale } from "../../../../lib/i18n-server";
import { getLibraryCopy } from "../../../../lib/library-view";

// Honest loading shell for /workspace/library/reviews.
export default async function Loading() {
  const copy = getLibraryCopy(await getRequestLocale());
  return (
    <section
      className="mx-auto max-w-5xl space-y-6"
      aria-busy="true"
      aria-labelledby="library-reviews-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="library-reviews-loading-heading" className="font-display text-primary">
          {copy.title}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {copy.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-28 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
