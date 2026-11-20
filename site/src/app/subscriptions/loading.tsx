import { getCommercialCopy } from "../../features/commerce/commercial-i18n";
import { subscriptionsCopy } from "../../features/commerce/subscriptions-i18n";
import { RouteHonestLoading } from "../../features/shell/route-honest-loading-server";
import { getRequestLocale } from "../../lib/i18n/server";

export default async function Loading() {
  const locale = await getRequestLocale();
  const copy = getCommercialCopy(locale);
  const status = subscriptionsCopy(locale);
  return (
    <RouteHonestLoading
      headingId="subscriptions-catalog-loading-heading"
      title={copy.catalog}
      loadingLabel={status.loading}
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      rows={4}
      rowClassName="h-28 rounded bg-inset"
      leading={<div className="h-10 w-72 rounded bg-inset" />}
    />
  );
}
