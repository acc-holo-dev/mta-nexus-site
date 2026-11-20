import { DictionaryFieldRouteLoading } from "../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return DictionaryFieldRouteLoading({
    headingId: "security-loading-heading",
    titlePath: "securityCenter.title",
    loadingPath: "securityCenter.loading",
    className: "mx-auto min-w-0 max-w-3xl space-y-6 overflow-x-clip py-8",
    leading: <div className="h-28 rounded bg-inset" />,
  });
}
