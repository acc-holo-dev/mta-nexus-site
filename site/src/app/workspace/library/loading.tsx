import { LibraryRouteLoading } from "../../../features/library/library-route-loading-server";
import { pageShellMax5xl } from "../../../features/shell/page-shell";

export default async function Loading() {
  return LibraryRouteLoading({
    headingId: "library-loading-heading",
    className: pageShellMax5xl,
    rowClassName: "h-28 rounded bg-inset",
    rows: 4,
    leading: (
      <>
        <div className="h-10 w-72 rounded bg-inset" />
        <div className="h-24 rounded bg-inset" />
      </>
    ),
    titleKey: "title",
  });
}
