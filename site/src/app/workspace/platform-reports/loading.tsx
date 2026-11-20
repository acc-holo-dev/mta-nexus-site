import { PlatformReportRouteLoading } from "../../../features/moderation/platform-report-route-loading-server";
import { pageShellMax5xl } from "../../../features/shell/page-shell";

export default async function Loading() {
  return PlatformReportRouteLoading({
    headingId: "platform-reports-loading-heading",
    className: pageShellMax5xl,
    leading: <div className="h-28 rounded bg-inset" />,
    titleKey: "title",
  });
}
