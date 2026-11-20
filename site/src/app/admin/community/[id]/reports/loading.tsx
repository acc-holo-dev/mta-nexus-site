import { reportGroupsCopy } from "../../../../../features/community/community-report-groups-copy";
import { getRequestLocale } from "../../../../../lib/i18n/server";
import { RouteHonestLoading } from "../../../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  const locale = await getRequestLocale();
  const copy = reportGroupsCopy(locale);
  return (
    <RouteHonestLoading
      headingId="admin-publication-reports-loading-heading"
      title={copy.publicationTitle}
      loadingLabel={copy.publicationLoading}
      className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip"
      titleClassName="text-2xl font-extrabold text-primary"
      leading={<div className="h-24 rounded bg-inset" />}
    />
  );
}
