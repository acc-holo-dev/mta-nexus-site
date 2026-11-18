import { getCommerceHistoryCopy } from "../../../../features/commerce/commerce-history-i18n";
import { getLicenseMaintenanceCopy } from "../../../../features/commerce/license-maintenance-i18n";
import { HonestLoadingShell } from "../../../../features/shell/honest-loading";
import { getRequestLocale } from "../../../../lib/platform/i18n-server";

// Honest loading shell for /admin/licenses/maintenance.
export default async function Loading() {
  const locale = await getRequestLocale();
  const copy = getLicenseMaintenanceCopy(locale);
  const history = getCommerceHistoryCopy(locale);
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      headingId="admin-license-maintenance-loading-heading"
      title={copy.maintenance}
      loadingLabel={history.loading}
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-10 w-72 rounded bg-inset" />
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </HonestLoadingShell>
  );
}
