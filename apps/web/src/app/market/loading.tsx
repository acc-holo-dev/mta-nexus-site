import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n-server";

// Honest loading shell for /market.
export default async function MarketLoading() {
  const locale = await getRequestLocale();
  const copy = getDictionary(locale).market;
  return (
    <section className="space-y-6" aria-busy="true" aria-labelledby="market-loading-heading">
      <header className="space-y-2 pb-1">
        <h1 id="market-loading-heading" className="font-display text-primary">
          {copy.title}
        </h1>
        <p role="status" aria-live="polite" className="font-caption text-muted">
          {copy.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-11 w-full max-w-xl rounded-lg bg-inset" />
        <div className="flex gap-2 overflow-hidden">
          {[1, 2, 3].map((key) => (
            <div key={key} className="h-10 w-24 shrink-0 rounded-full bg-inset" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((key) => (
            <div key={key} className="h-48 rounded-lg bg-inset" />
          ))}
        </div>
      </div>
    </section>
  );
}
