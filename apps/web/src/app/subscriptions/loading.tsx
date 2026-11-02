import { getCommercialCopy } from "../../lib/commercial-i18n";
import { getRequestLocale } from "../../lib/i18n-server";
import { subscriptionsCopy } from "../../lib/subscriptions-i18n";

// Honest loading shell for /subscriptions.
export default async function Loading() {
  const locale = await getRequestLocale();
  const copy = getCommercialCopy(locale);
  const status = subscriptionsCopy(locale);
  return (
    <section
      className="mx-auto max-w-5xl space-y-6 py-8"
      aria-busy="true"
      aria-labelledby="subscriptions-catalog-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="subscriptions-catalog-loading-heading" className="font-display text-primary">
          {copy.catalog}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {status.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-10 w-72 rounded bg-inset" />
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="h-28 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
