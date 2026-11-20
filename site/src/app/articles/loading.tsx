import { DictionaryRouteLoading } from "../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return DictionaryRouteLoading({
    headingId: "articles-loading-heading",
    className: "min-w-0 space-y-8 overflow-x-clip",
    headerClassName: "space-y-2 border-b border-base pb-6",
    titleClassName: "text-2xl font-extrabold text-primary sm:text-3xl",
    rows: 4,
    rowClassName: "h-28 rounded bg-inset",
    leading: <div className="h-11 rounded bg-inset" />,
    pick: (dictionary) => ({
      title: dictionary.articles.title,
      loading: dictionary.articles.loading,
    }),
  });
}
