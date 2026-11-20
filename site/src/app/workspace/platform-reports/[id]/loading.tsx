import { platformReportCopy } from "../../../../features/moderation/platform-report-i18n";
import { RouteHonestLoading } from "../../../../features/shell/route-honest-loading-server";
import { getRequestLocale } from "../../../../lib/i18n/server";

export default async function PlatformReportDetailLoading() {
  const locale = await getRequestLocale();
  const copy = platformReportCopy(locale === "ru" ? "ru" : "en");
  return (
    <RouteHonestLoading
      headingId="platform-report-detail-loading-heading"
      title={copy.detail}
      loadingLabel={copy.loading}
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      rows={0}
      leading={
        <>
          <div className="h-28 rounded bg-inset" />
          <div className="h-40 rounded bg-inset" />
        </>
      }
    />
  );
}
