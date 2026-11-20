import { PlatformReportRouteLoading } from "../../../features/moderation/platform-report-route-loading-server";

export default async function Loading() {
  return PlatformReportRouteLoading({
    headingId: "platform-reports-loading-heading",
    className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8",
    leading: <div className="h-28 rounded bg-inset" />,
    titleKey: "title",
  });
}
