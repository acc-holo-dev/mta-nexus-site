import { DictionaryRouteLoading } from "../../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return DictionaryRouteLoading({
    headingId: "author-resource-loading-heading",
    className: "mx-auto min-w-0 max-w-5xl overflow-x-clip space-y-6",
    headerClassName: "border-b border-base pb-6",
    statusClassName: "mt-2 text-sm text-muted",
    rowClassName: "h-24 rounded bg-inset",
    leading: <div className="h-32 rounded bg-inset" />,
    pick: (dictionary) => ({
      title: dictionary.authorResources.edit,
      loading: dictionary.authorResources.loading,
    }),
  });
}
