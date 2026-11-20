import { DictionaryFieldRouteLoading } from "../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return DictionaryFieldRouteLoading({
    headingId: "developer-loading-heading",
    titlePath: "developers.creatorProfile",
    loadingPath: "developers.loading",
    className: "min-w-0 space-y-6 overflow-x-clip",
    rows: 0,
    leading: (
      <>
        <div className="h-28 max-w-full rounded bg-inset" />
        <div className="h-40 max-w-full rounded bg-inset" />
      </>
    ),
  });
}
