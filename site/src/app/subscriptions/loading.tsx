import { getCommercialCopy } from "../../features/commerce/commercial-i18n";
import { subscriptionsCopy } from "../../features/commerce/subscriptions-i18n";
import { HonestLoadingShell } from "../../features/shell/honest-loading";
import { getRequestLocale } from "../../lib/i18n/server";

// Honest loading shell for /subscriptions.
export default async function Loading() {
  const locale = await getRequestLocale();
  const copy = getCommercialCopy(locale);
  const status = subscriptionsCopy(locale);
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      headingId="subscriptions-catalog-loading-heading"
      title={copy.catalog}
      loadingLabel={status.loading}
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-10 w-72 rounded bg-inset" />
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="h-28 rounded bg-inset" />
        ))}
      </div>
    </HonestLoadingShell>
  );
}
