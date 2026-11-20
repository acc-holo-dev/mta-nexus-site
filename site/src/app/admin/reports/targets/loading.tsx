import { CommunityReportGroupsRouteLoading } from "../../../../features/community/community-report-groups-route-loading-server";

export default async function Loading() {
  return CommunityReportGroupsRouteLoading({
    headingId: "report-groups-loading-heading",
    className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip",
    leading: <div className="h-32 rounded bg-inset" />,
    titleKey: "title",
  });
}
