import { ResourceReleaseWatchHistoryRouteLoading } from "../../../../../features/resources/resource-release-watch-history-route-loading-server";

export default async function Loading() {
  return ResourceReleaseWatchHistoryRouteLoading({
    headingId: "release-watch-history-loading-heading",
    className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip",
    rowClassName: "h-24 rounded bg-inset",
    leading: <div className="h-28 rounded bg-inset" />,
    titleKey: "title",
  });
}
