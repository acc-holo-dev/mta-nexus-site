import { getCommerceHistoryCopy } from "../../../../lib/commerce-history-i18n";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { getLicenseMaintenanceCopy } from "../../../../lib/license-maintenance-i18n";

// Honest loading shell for /admin/licenses/maintenance.
export default async function Loading() {
  const locale = await getRequestLocale();
  const copy = getLicenseMaintenanceCopy(locale);
  const history = getCommerceHistoryCopy(locale);
  return (
    <section
      className="mx-auto max-w-5xl space-y-6 py-8"
      aria-busy="true"
      aria-labelledby="admin-license-maintenance-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="admin-license-maintenance-loading-heading" className="font-display text-primary">
          {copy.maintenance}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {history.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-10 w-72 rounded bg-inset" />
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
