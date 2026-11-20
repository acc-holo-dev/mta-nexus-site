import { communityReportCopy } from "../../../../features/community/community-report-copy";
import { getRequestLocale } from "../../../../lib/i18n/server";
import { RouteHonestLoading } from "../../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  const copy = communityReportCopy(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="admin-report-detail-loading-heading"
      title={copy.detail}
      loadingLabel={copy.loading}
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip"
      leading={<div className="h-28 rounded bg-inset" />}
    />
  );
}
