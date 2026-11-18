import { getFinancialCopy } from "../../../../../features/commerce/financial-i18n";
import { HonestLoadingShell } from "../../../../../features/shell/honest-loading";
import { getRequestLocale } from "../../../../../lib/platform/i18n-server";

// Honest loading shell for /admin/commerce/reconciliation/[id].
export default async function Loading() {
  const copy = getFinancialCopy(await getRequestLocale());
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8"
      headingId="admin-reconciliation-detail-loading-heading"
      title={copy.review}
      loadingLabel={copy.reviewLoading}
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-10 w-72 max-w-full rounded bg-inset" />
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </HonestLoadingShell>
  );
}
