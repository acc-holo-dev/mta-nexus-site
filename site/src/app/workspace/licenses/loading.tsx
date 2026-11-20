import { getCommerceHistoryCopy } from "../../../features/commerce/commerce-history-i18n";
import { RouteHonestLoading } from "../../../features/shell/route-honest-loading-server";
import { getRequestLocale } from "../../../lib/i18n/server";

export default async function Loading() {
  const copy = getCommerceHistoryCopy(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="licenses-loading-heading"
      title={copy.licensesTitle}
      loadingLabel={copy.loading}
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      rows={4}
      leading={<div className="h-10 w-64 rounded bg-inset" />}
    />
  );
}
