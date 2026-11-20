import { getResourceCommerceCopy } from "../../../features/resources/resource-commerce-i18n";
import { RouteHonestLoading } from "../../../features/shell/route-honest-loading-server";
import { getRequestLocale } from "../../../lib/i18n/server";

export default async function Loading() {
  const copy = getResourceCommerceCopy(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="cart-loading-heading"
      title={copy.cart}
      loadingLabel={copy.loading}
      className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8"
      leading={<div className="h-24 rounded bg-inset" />}
    />
  );
}
