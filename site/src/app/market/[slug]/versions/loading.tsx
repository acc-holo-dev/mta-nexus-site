import { PublicReleaseHistoryRouteLoading } from "../../../../features/resources/public-release-history-route-loading-server";

export default async function Loading() {
  return PublicReleaseHistoryRouteLoading({
    headingId: "market-versions-loading-heading",
    className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8",
    rowClassName: "h-16 rounded bg-inset",
    rows: 4,
    titleKey: "title",
  });
}
