import { getCommercialCopy } from "../../../../../features/commerce/commercial-i18n";
import { HonestLoadingShell } from "../../../../../features/shell/honest-loading";
import { getRequestLocale } from "../../../../../lib/platform/i18n-server";

// Honest loading shell for /admin/commerce/plans/[id].
export default async function Loading() {
  const copy = getCommercialCopy(await getRequestLocale());
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8"
      headingId="admin-plan-detail-loading-heading"
      title={copy.admin}
      loadingLabel={copy.loading}
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
