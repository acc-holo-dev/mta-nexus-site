import { getDictionary } from "../../../../lib/i18n";
import { getRequestLocale } from "../../../../lib/i18n-server";

// Honest loading shell for /market/[slug]/reviews.
export default async function Loading() {
  const dictionary = getDictionary(await getRequestLocale());
  return (
    <section
      className="min-w-0 space-y-6 overflow-x-clip"
      aria-busy="true"
      aria-labelledby="market-reviews-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="market-reviews-loading-heading" className="font-display text-primary">
          {dictionary.market.title}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {dictionary.market.loading}
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
