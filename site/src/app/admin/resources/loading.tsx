import { getResourceReleaseControlCopy } from "../../../features/library/resource-release-control-i18n";
import { RouteHonestLoading } from "../../../features/shell/route-honest-loading-server";
import { getRequestLocale } from "../../../lib/i18n/server";

export default async function Loading() {
  const copy = getResourceReleaseControlCopy(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="admin-resources-loading-heading"
      title={copy.moderation}
      loadingLabel={copy.moderationLoading}
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      leading={<div className="h-28 rounded bg-inset" />}
    />
  );
}
