import { DictionaryFieldRouteLoading } from "../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return DictionaryFieldRouteLoading({
    headingId: "discover-loading-heading",
    titlePath: "discover.title",
    loadingPath: "discover.loading",
    className: "min-w-0 space-y-6 overflow-x-clip",
    rows: 4,
    rowClassName: "h-24 rounded bg-inset",
    leading: (
      <>
        <div className="h-11 rounded bg-inset" />
        <div className="h-10 w-96 max-w-full rounded bg-inset" />
      </>
    ),
  });
}
