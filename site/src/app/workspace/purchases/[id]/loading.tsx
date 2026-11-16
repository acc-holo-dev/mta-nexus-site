import { getCommerceHistoryCopy } from "../../../../lib/commerce-history-i18n";
import { getRequestLocale } from "../../../../lib/i18n-server";

// Honest loading shell for /workspace/purchases/[id].
export default async function Loading() {
  const locale = await getRequestLocale();
  const typedLocale: "en" | "ru" = locale === "ru" ? "ru" : "en";
  const copy = getCommerceHistoryCopy(typedLocale);
  return (
    <section
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      aria-busy="true"
      aria-labelledby="purchase-detail-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="purchase-detail-loading-heading" className="font-display text-primary">
          {copy.details}
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
