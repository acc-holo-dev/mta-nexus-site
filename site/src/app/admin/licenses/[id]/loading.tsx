import { getCommerceHistoryCopy } from "../../../../features/commerce/commerce-history-i18n";
import { getLicenseControlCopy } from "../../../../features/commerce/license-control-i18n";
import { getRequestLocale } from "../../../../lib/i18n/server";
import { RouteHonestLoading } from "../../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  const locale = await getRequestLocale();
  const copy = getLicenseControlCopy(locale);
  const history = getCommerceHistoryCopy(locale);
  return (
    <RouteHonestLoading
      headingId="admin-license-detail-loading-heading"
      title={copy.title}
      loadingLabel={history.loading}
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      leading={<div className="h-28 rounded bg-inset" />}
    />
  );
}
