import { platformReportCopy } from "../../../../features/moderation/platform-report-i18n";
import { LocaleCopyRouteLoading } from "../../../../features/shell/route-honest-loading-server";

export default async function PlatformReportDetailLoading() {
  return LocaleCopyRouteLoading({
    headingId: "platform-report-detail-loading-heading",
    className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8",
    rows: 0,
    leading: (
      <>
        <div className="h-28 rounded bg-inset" />
        <div className="h-40 rounded bg-inset" />
      </>
    ),
    load: (locale) => {
      const copy = platformReportCopy(locale === "ru" ? "ru" : "en");
      return {
        title: copy.detail,
        loading: copy.loading,
      };
    },
  });
}
