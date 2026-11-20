import { LibraryCollectionsRouteLoading } from "../../../../../../features/library/library-collections-route-loading-server";

export default async function Loading() {
  return LibraryCollectionsRouteLoading({
    headingId: "collection-reconcile-loading-heading",
    titleKey: "reconcile-items",
    leading: <div className="h-10 w-72 rounded bg-inset" />,
  });
}
