import { DictionaryRouteLoading } from "../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return DictionaryRouteLoading({
    headingId: "organization-loading-heading",
    className: "min-w-0 space-y-6 overflow-x-clip",
    rows: 0,
    leading: (
      <>
        <div className="h-28 max-w-full rounded bg-inset" />
        <div className="h-40 max-w-full rounded bg-inset" />
        <div className="h-32 max-w-full rounded bg-inset" />
      </>
    ),
    pick: (dictionary) => ({
      title: dictionary.organizations.title,
      loading: dictionary.organizations.loading,
    }),
  });
}
