import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n-server";

// Honest loading shell for /market/[slug].
export default async function Loading() {
  const dictionary = getDictionary(await getRequestLocale());
  return (
    <section
      className="min-w-0 space-y-6 overflow-x-clip"
      aria-busy="true"
      aria-labelledby="market-resource-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="market-resource-loading-heading" className="font-display text-primary">
          {dictionary.market.title}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {dictionary.market.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-48 rounded bg-inset" />
        <div className="h-8 w-64 max-w-full rounded bg-inset" />
        <div className="h-24 rounded bg-inset" />
        <div className="h-32 rounded bg-inset" />
      </div>
    </section>
  );
}
