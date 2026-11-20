import { CommunityReportRouteLoading } from "../../../features/community/community-report-route-loading-server";

export default async function Loading() {
  return CommunityReportRouteLoading({
    headingId: "workspace-reports-loading-heading",
    titleKey: "title",
  });
}
