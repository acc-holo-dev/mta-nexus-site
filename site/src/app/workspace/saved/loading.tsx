import { followCopy } from "../../../features/community/follow-workspace-copy";
import { RouteHonestLoading } from "../../../features/shell/route-honest-loading-server";
import { getRequestLocale } from "../../../lib/i18n/server";

export default async function Loading() {
  const copy = followCopy(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="saved-follows-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      rows={4}
      rowClassName="h-24 rounded bg-inset"
      leading={<div className="h-10 w-64 rounded bg-inset" />}
    />
  );
}
