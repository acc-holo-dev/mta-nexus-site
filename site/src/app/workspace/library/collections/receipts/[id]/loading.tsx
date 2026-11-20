import { LibraryCollectionsRouteLoading } from "../../../../../../features/library/library-collections-route-loading-server";

export default async function Loading() {
  return LibraryCollectionsRouteLoading({
    headingId: "collection-receipt-loading-heading",
    titleKey: "history",
  });
}
