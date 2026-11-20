import { DictionaryRouteLoading } from "../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return DictionaryRouteLoading({
    headingId: "acquire-loading-heading",
    className: "mx-auto min-w-0 max-w-3xl space-y-6 overflow-x-clip py-8",
    rows: 0,
    leading: (
      <>
        <div className="h-28 rounded bg-inset" />
        <div className="h-12 w-48 rounded bg-inset" />
        <div className="h-20 rounded bg-inset" />
      </>
    ),
    pick: (dictionary) => ({
      title: dictionary.checkout.title,
      loading: dictionary.checkout.loadingProduct,
    }),
  });
}
