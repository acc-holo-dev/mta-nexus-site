import { resourceReleaseWatchesCopy } from "../../../../features/resources/resource-release-watches-i18n";
import { getRequestLocale } from "../../../../lib/i18n/server";
import { RouteHonestLoading } from "../../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  const copy = resourceReleaseWatchesCopy(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="release-watches-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip"
      rowClassName="h-24 rounded bg-inset"
      leading={<div className="h-28 rounded bg-inset" />}
    />
  );
}
