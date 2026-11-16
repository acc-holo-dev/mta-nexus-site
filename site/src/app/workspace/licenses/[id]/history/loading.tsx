import { getCommerceHistoryCopy } from "../../../../../lib/commerce-history-i18n";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { getLicenseControlCopy } from "../../../../../lib/license-control-i18n";

// Honest loading shell for /workspace/licenses/[id]/history.
export default async function Loading() {
  const locale = await getRequestLocale();
  const copy = getLicenseControlCopy(locale);
  const history = getCommerceHistoryCopy(locale);
  return (
    <section
      className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8"
      aria-busy="true"
      aria-labelledby="license-history-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="license-history-loading-heading" className="font-display text-primary">
          {copy.fullHistory}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {history.loading}
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
