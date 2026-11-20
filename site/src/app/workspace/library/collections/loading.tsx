import { LibraryCollectionsRouteLoading } from "../../../../features/library/library-collections-route-loading-server";
import { pageShellMax4xl } from "../../../../features/shell/page-shell";

export default async function Loading() {
  return LibraryCollectionsRouteLoading({
    headingId: "library-collections-loading-heading",
    titleKey: "title",
    className: pageShellMax4xl,
    rows: 3,
    leading: <div className="h-28 rounded bg-inset" />,
  });
}
