import { getCommercialCopy } from "../../../../features/commerce/commercial-i18n";
import { RouteHonestLoading } from "../../../../features/shell/route-honest-loading-server";
import { getRequestLocale } from "../../../../lib/i18n/server";

export default async function Loading() {
  const copy = getCommercialCopy(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="admin-plans-loading-heading"
      title={copy.admin}
      loadingLabel={copy.loading}
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      rows={4}
      leading={<div className="h-10 w-72 rounded bg-inset" />}
    />
  );
}
