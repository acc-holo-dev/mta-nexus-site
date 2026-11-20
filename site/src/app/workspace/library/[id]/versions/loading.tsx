import { ResourceReleaseControlRouteLoading } from "../../../../../features/library/resource-release-control-route-loading-server";

export default async function Loading() {
  return ResourceReleaseControlRouteLoading({
    headingId: "library-versions-loading-heading",
    titleKey: "versions",
    loadingKey: "updatesLoading",
  });
}
