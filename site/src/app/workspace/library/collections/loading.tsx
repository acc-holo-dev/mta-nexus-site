import { LibraryCollectionsRouteLoading } from "../../../../features/library/library-collections-route-loading-server";

export default async function Loading() {
  return LibraryCollectionsRouteLoading({
    headingId: "library-collections-loading-heading",
    titleKey: "title",
    className: "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8",
    rows: 3,
    leading: <div className="h-28 rounded bg-inset" />,
  });
}
