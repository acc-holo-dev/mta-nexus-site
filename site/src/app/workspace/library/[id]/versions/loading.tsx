import { getResourceReleaseControlCopy } from "../../../../../features/library/resource-release-control-i18n";
import { RouteHonestLoading } from "../../../../../features/shell/route-honest-loading-server";
import { getRequestLocale } from "../../../../../lib/i18n/server";

export default async function Loading() {
  const copy = getResourceReleaseControlCopy(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="library-versions-loading-heading"
      title={copy.versions}
      loadingLabel={copy.updatesLoading}
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      rows={4}
      rowClassName="h-24 rounded bg-inset"
      leading={<div className="h-10 w-64 rounded bg-inset" />}
    />
  );
}
