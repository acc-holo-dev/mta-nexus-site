import { getCommerceHistoryCopy } from "../../../../features/commerce/commerce-history-i18n";
import { getLicenseMaintenanceCopy } from "../../../../features/commerce/license-maintenance-i18n";
import { RouteHonestLoading } from "../../../../features/shell/route-honest-loading-server";
import { getRequestLocale } from "../../../../lib/i18n/server";

export default async function Loading() {
  const locale = await getRequestLocale();
  const copy = getLicenseMaintenanceCopy(locale);
  const history = getCommerceHistoryCopy(locale);
  return (
    <RouteHonestLoading
      headingId="admin-license-maintenance-loading-heading"
      title={copy.maintenance}
      loadingLabel={history.loading}
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      rows={4}
      leading={<div className="h-10 w-72 rounded bg-inset" />}
    />
  );
}
