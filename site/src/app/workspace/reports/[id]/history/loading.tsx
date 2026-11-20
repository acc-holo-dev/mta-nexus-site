import { CommunityReportHistoryRouteLoading } from "../../../../../features/community/community-report-history-route-loading-server";

export default async function Loading() {
  return CommunityReportHistoryRouteLoading({
    headingId: "report-history-loading-heading",
    className: "nexus-panel min-w-0 space-y-4 overflow-x-clip p-6",
    titleClassName: "text-xl font-semibold text-primary",
    leading: <div className="h-6 w-2/3 rounded bg-inset" />,
    titleKey: "title",
  });
}
