import { CommunityReportGroupsRouteLoading } from "../../../../../features/community/community-report-groups-route-loading-server";
import { pageShellMax4xlTight } from "../../../../../features/shell/page-shell";

export default async function Loading() {
  return CommunityReportGroupsRouteLoading({
    headingId: "admin-publication-reports-loading-heading",
    className: pageShellMax4xlTight,
    titleClassName: "text-2xl font-extrabold text-primary",
    leading: <div className="h-24 rounded bg-inset" />,
    titleKey: "publicationTitle",
    loadingKey: "publicationLoading",
  });
}
