import { DictionaryFieldRouteLoading } from "../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return DictionaryFieldRouteLoading({
    headingId: "market-loading-heading",
    titlePath: "market.title",
    loadingPath: "market.loading",
    className: "min-w-0 space-y-6 overflow-x-clip",
    rows: 6,
    rowClassName: "h-40 rounded bg-inset",
    leading: (
      <>
        <div className="h-11 rounded bg-inset" />
        <div className="h-10 w-80 max-w-full rounded bg-inset" />
      </>
    ),
  });
}
