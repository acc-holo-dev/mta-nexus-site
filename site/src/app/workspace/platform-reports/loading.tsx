import { platformReportCopy } from "../../../features/moderation/platform-report-i18n";
import { RouteHonestLoading } from "../../../features/shell/route-honest-loading-server";
import { getRequestLocale } from "../../../lib/i18n/server";

export default async function Loading() {
  const locale = await getRequestLocale();
  const copy = platformReportCopy(locale === "ru" ? "ru" : "en");
  return (
    <RouteHonestLoading
      headingId="platform-reports-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      leading={<div className="h-28 rounded bg-inset" />}
    />
  );
}
