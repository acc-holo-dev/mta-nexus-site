import { PlatformReportRouteLoading } from "../../../../features/moderation/platform-report-route-loading-server";
import { pageShellMax5xl } from "../../../../features/shell/page-shell";

export default async function Loading() {
  return PlatformReportRouteLoading({
    headingId: "platform-report-detail-loading-heading",
    className: pageShellMax5xl,
    rows: 0,
    leading: (
      <>
        <div className="h-28 rounded bg-inset" />
        <div className="h-40 rounded bg-inset" />
      </>
    ),
    titleKey: "detail",
  });
}
