import { LibraryCollectionsRouteLoading } from "../../../../../../features/library/library-collections-route-loading-server";

export default async function Loading() {
  return LibraryCollectionsRouteLoading({
    headingId: "collection-add-loading-heading",
    titleKey: "add",
  });
}
