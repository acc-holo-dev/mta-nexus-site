import { ResourceReleaseControlRouteLoading } from "../../../../features/library/resource-release-control-route-loading-server";

export default async function Loading() {
  return ResourceReleaseControlRouteLoading({
    headingId: "admin-resource-detail-loading-heading",
    rowClassName: "h-16 rounded bg-inset",
    leading: <div className="h-32 rounded bg-inset" />,
    titleKey: "moderation",
    loadingKey: "moderationLoading",
  });
}
