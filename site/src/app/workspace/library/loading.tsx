import { LibraryRouteLoading } from "../../../features/library/library-route-loading-server";

export default async function Loading() {
  return LibraryRouteLoading({
    headingId: "library-loading-heading",
    className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8",
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
