import { LibraryCollectionsRouteLoading } from "../../../../../features/library/library-collections-route-loading-server";

export default async function Loading() {
  return LibraryCollectionsRouteLoading({
    headingId: "resource-collections-loading-heading",
    titleKey: "resourceCollections",
    rows: 3,
  });
}
