import { DictionaryFieldRouteLoading } from "../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return DictionaryFieldRouteLoading({
    headingId: "community-loading-heading",
    titlePath: "community.title",
    loadingPath: "community.loading",
    className: "min-w-0 space-y-6 overflow-x-clip",
    headerClassName: "space-y-2 border-b border-base pb-5",
    rows: 5,
    leading: <div className="h-11 rounded bg-inset" />,
  });
}
