import { ResourceReleaseControlRouteLoading } from "../../../../features/library/resource-release-control-route-loading-server";

export default async function Loading() {
  return ResourceReleaseControlRouteLoading({
    headingId: "library-updates-loading-heading",
    rowClassName: "h-32 rounded bg-inset",
    leading: <div className="h-12 rounded bg-inset" />,
    titleKey: "updates",
    loadingKey: "updatesLoading",
  });
}
