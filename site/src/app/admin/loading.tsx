import { DictionaryFieldRouteLoading } from "../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return DictionaryFieldRouteLoading({
    headingId: "admin-loading-heading",
    titlePath: "admin.title",
    loadingPath: "admin.loading",
    className: "min-w-0 space-y-6 overflow-x-clip",
    rows: 4,
    leading: <div className="h-28 rounded bg-inset" />,
  });
}
