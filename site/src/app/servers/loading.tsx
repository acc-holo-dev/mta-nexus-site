import { DictionaryFieldRouteLoading } from "../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return DictionaryFieldRouteLoading({
    headingId: "servers-loading-heading",
    titlePath: "servers.title",
    loadingPath: "servers.loading",
    className: "min-w-0 space-y-8 overflow-x-clip",
    rows: 5,
    leading: <div className="h-11 rounded bg-inset" />,
  });
}
