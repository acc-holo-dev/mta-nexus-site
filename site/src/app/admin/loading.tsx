import { DictionaryRouteLoading } from "../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return DictionaryRouteLoading({
    headingId: "admin-loading-heading",
    className: "min-w-0 space-y-6 overflow-x-clip",
    rows: 4,
    leading: <div className="h-28 rounded bg-inset" />,
    pick: (dictionary) => ({
      title: dictionary.admin.title,
      loading: dictionary.admin.loading,
    }),
  });
}
