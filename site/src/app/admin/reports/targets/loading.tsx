import { CommunityReportGroupsRouteLoading } from "../../../../features/community/community-report-groups-route-loading-server";
import { pageShellMax5xlTight } from "../../../../features/shell/page-shell";

export default async function Loading() {
  return CommunityReportGroupsRouteLoading({
    headingId: "report-groups-loading-heading",
    className: pageShellMax5xlTight,
    leading: <div className="h-32 rounded bg-inset" />,
    titleKey: "title",
  });
}
