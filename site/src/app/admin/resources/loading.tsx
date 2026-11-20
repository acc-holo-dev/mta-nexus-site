import { ResourceReleaseControlRouteLoading } from "../../../features/library/resource-release-control-route-loading-server";

export default async function Loading() {
  return ResourceReleaseControlRouteLoading({
    headingId: "admin-resources-loading-heading",
    leading: <div className="h-28 rounded bg-inset" />,
    titleKey: "moderation",
    loadingKey: "moderationLoading",
  });
}
