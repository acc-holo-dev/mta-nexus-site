import { CommunityReportGroupsRouteLoading } from "../../../../../features/community/community-report-groups-route-loading-server";

export default async function Loading() {
  return CommunityReportGroupsRouteLoading({
    headingId: "admin-publication-reports-loading-heading",
    className: "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip",
    titleClassName: "text-2xl font-extrabold text-primary",
    leading: <div className="h-24 rounded bg-inset" />,
    titleKey: "publicationTitle",
    loadingKey: "publicationLoading",
  });
}
