import { reportGroupsCopy } from "../../../../features/community/community-report-groups-copy";
import { getRequestLocale } from "../../../../lib/i18n/server";
import { RouteHonestLoading } from "../../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  const copy = reportGroupsCopy(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="report-groups-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip"
      leading={<div className="h-32 rounded bg-inset" />}
    />
  );
}
