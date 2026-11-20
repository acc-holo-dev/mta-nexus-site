import { LibraryCollectionHistoryRouteLoading } from "../../../../../features/library/library-collection-history-route-loading-server";

export default async function Loading() {
  return LibraryCollectionHistoryRouteLoading({
    headingId: "collection-history-loading-heading",
    className: "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip",
    leading: <div className="h-28 rounded bg-inset" />,
    titleKey: "title",
  });
}
