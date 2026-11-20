import { DictionaryFieldRouteLoading } from "../../../../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return DictionaryFieldRouteLoading({
    headingId: "library-versions-compare-loading-heading",
    titlePath: "workspace.libraryTitle",
    loadingPath: "workspace.loading",
    className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8",
    rows: 4,
    leading: <div className="h-10 w-64 rounded bg-inset" />,
  });
}
