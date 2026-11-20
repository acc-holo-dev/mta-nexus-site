import { reportHistoryCopy } from "../../../../../features/community/community-report-history-copy";
import { RouteHonestLoading } from "../../../../../features/shell/route-honest-loading-server";
import { getRequestLocale } from "../../../../../lib/i18n/server";

export default async function Loading() {
  const copy = reportHistoryCopy(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="report-history-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      className="nexus-panel min-w-0 space-y-4 overflow-x-clip p-6"
      titleClassName="text-xl font-semibold text-primary"
      leading={<div className="h-6 w-2/3 rounded bg-inset" />}
    />
  );
}
