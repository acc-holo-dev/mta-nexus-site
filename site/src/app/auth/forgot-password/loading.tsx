import { DictionaryFieldRouteLoading } from "../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return DictionaryFieldRouteLoading({
    headingId: "auth-forgot-loading-heading",
    titlePath: "recovery.forgotTitle",
    loadingPath: "errors.loading",
    className: "mx-auto min-w-0 max-w-md space-y-6 overflow-x-clip py-16",
    headerClassName: "space-y-2 text-center",
    rows: 0,
    leading: (
      <>
        <div className="h-11 rounded bg-inset" />
        <div className="h-11 rounded bg-inset" />
      </>
    ),
  });
}
