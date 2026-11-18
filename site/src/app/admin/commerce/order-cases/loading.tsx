import { getCommerceHistoryCopy } from "../../../../features/commerce/commerce-history-i18n";
import { orderCaseCopy } from "../../../../features/commerce/order-case-i18n";
import { HonestLoadingShell } from "../../../../features/shell/honest-loading";
import { getRequestLocale } from "../../../../lib/platform/i18n-server";

// Honest loading shell for /admin/commerce/order-cases.
export default async function Loading() {
  const locale = await getRequestLocale();
  const copy = orderCaseCopy(locale);
  const history = getCommerceHistoryCopy(locale);
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      headingId="admin-order-cases-loading-heading"
      title={copy.queue}
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
