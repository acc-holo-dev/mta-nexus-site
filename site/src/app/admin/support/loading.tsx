import { DictionaryFieldRouteLoading } from "../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return DictionaryFieldRouteLoading({
    headingId: "admin-support-loading-heading",
    titlePath: "support.staffQueue",
    loadingPath: "support.loading",
    className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip",
    headerClassName: "space-y-2 border-b border-base pb-6",
    leading: <div className="h-28 rounded bg-inset" />,
  });
}
