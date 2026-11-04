import { getFinancialCopy } from "../../../../lib/financial-i18n";
import { getRequestLocale } from "../../../../lib/i18n-server";

// Honest loading shell for /admin/commerce/reconciliation.
export default async function Loading() {
  const copy = getFinancialCopy(await getRequestLocale());
  return (
    <section
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      aria-busy="true"
      aria-labelledby="admin-reconciliation-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="admin-reconciliation-loading-heading" className="font-display text-primary">
          {copy.review}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {copy.reviewLoading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-10 w-72 max-w-full rounded bg-inset" />
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
