import { getReleaseHistoryCopy } from "../../../../features/resources/public-release-history";
import { RouteHonestLoading } from "../../../../features/shell/route-honest-loading-server";
import { getRequestLocale } from "../../../../lib/i18n/server";

export default async function Loading() {
  const copy = getReleaseHistoryCopy(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="market-versions-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      rows={4}
      rowClassName="h-16 rounded bg-inset"
    />
  );
}
