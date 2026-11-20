import { discoveryCopy } from "../../features/discovery/discovery-copy";
import { RouteHonestLoading } from "../../features/shell/route-honest-loading-server";
import { getRequestLocale } from "../../lib/i18n/server";

export default async function Loading() {
  const copy = discoveryCopy(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="organizations-loading-heading"
      title={copy.organizationsTitle}
      loadingLabel={copy.organizationsLoading}
      rows={4}
      rowClassName="h-24 max-w-full rounded bg-inset"
      leading={<div className="h-11 max-w-full rounded bg-inset" />}
    />
  );
}
