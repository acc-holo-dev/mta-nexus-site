import { LibraryCollectionHistoryRouteLoading } from "../../../../../features/library/library-collection-history-route-loading-server";
import { pageShellMax4xlTight } from "../../../../../features/shell/page-shell";

export default async function Loading() {
  return LibraryCollectionHistoryRouteLoading({
    headingId: "collection-history-loading-heading",
    className: pageShellMax4xlTight,
    leading: <div className="h-28 rounded bg-inset" />,
    titleKey: "title",
  });
}
