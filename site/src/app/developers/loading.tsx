import { DictionaryFieldRouteLoading } from "../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return DictionaryFieldRouteLoading({
    headingId: "developers-loading-heading",
    titlePath: "developers.title",
    loadingPath: "developers.loading",
    className: "min-w-0 space-y-6 overflow-x-clip",
    headerClassName: "space-y-2 border-b border-base pb-6",
    titleClassName: "text-2xl font-extrabold text-primary",
    rows: 4,
    rowClassName: "h-24 max-w-full rounded bg-inset",
    leading: <div className="h-11 max-w-full rounded bg-inset" />,
  });
}
