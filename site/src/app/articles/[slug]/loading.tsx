import { DictionaryFieldRouteLoading } from "../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return DictionaryFieldRouteLoading({
    headingId: "article-loading-heading",
    titlePath: "articles.title",
    loadingPath: "articles.loading",
    className: "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip",
    rows: 0,
    leading: (
      <>
        <div className="h-10 w-72 max-w-full rounded bg-inset" />
        <div className="h-40 rounded bg-inset" />
        <div className="h-64 rounded bg-inset" />
      </>
    ),
  });
}
