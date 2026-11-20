import { DictionaryFieldRouteLoading } from "../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return DictionaryFieldRouteLoading({
    headingId: "server-detail-loading-heading",
    titlePath: "serverDetail.breadcrumb",
    loadingPath: "serverDetail.loading",
    className: "min-w-0 space-y-6 overflow-x-clip",
    rows: 0,
    leading: (
      <>
        <div className="h-32 rounded bg-inset" />
        <div className="h-24 rounded bg-inset" />
        <div className="h-40 rounded bg-inset" />
      </>
    ),
  });
}
