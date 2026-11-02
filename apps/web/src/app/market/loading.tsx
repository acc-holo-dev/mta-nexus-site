import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n-server";

// Honest loading shell for /market.
export default async function Loading() {
  const dictionary = getDictionary(await getRequestLocale());
  return (
    <section className="space-y-6" aria-busy="true" aria-labelledby="market-loading-heading">
      <header className="space-y-2">
        <h1 id="market-loading-heading" className="font-display text-primary">
          {dictionary.market.title}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {dictionary.market.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-11 rounded bg-inset" />
        <div className="h-10 w-80 rounded bg-inset" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((key) => (
            <div key={key} className="h-40 rounded bg-inset" />
          ))}
        </div>
      </div>
    </section>
  );
}
