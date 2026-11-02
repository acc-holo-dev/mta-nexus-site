import { getRequestLocale } from "../../../lib/i18n-server";
import { getCommerceHistoryCopy } from "../../../lib/commerce-history-i18n";

// Honest loading shell for /workspace/purchases.
export default async function Loading() {
  const copy = getCommerceHistoryCopy(await getRequestLocale());
  return (
    <section
      className="mx-auto max-w-5xl space-y-6 py-8"
      aria-busy="true"
      aria-labelledby="purchases-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="purchases-loading-heading" className="font-display text-primary">
          {copy.purchasesTitle}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {copy.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-10 w-64 rounded bg-inset" />
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
