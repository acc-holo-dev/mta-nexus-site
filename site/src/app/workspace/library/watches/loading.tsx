import { ResourceReleaseWatchesRouteLoading } from "../../../../features/resources/resource-release-watches-route-loading-server";

export default async function Loading() {
  return ResourceReleaseWatchesRouteLoading({
    headingId: "release-watches-loading-heading",
    className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip",
    rowClassName: "h-24 rounded bg-inset",
    leading: <div className="h-28 rounded bg-inset" />,
    titleKey: "title",
  });
}
