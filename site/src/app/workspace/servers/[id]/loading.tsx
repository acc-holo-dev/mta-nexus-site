import { DictionaryRouteLoading } from "../../../../features/shell/route-honest-loading-server";

export default function Loading() {
  return (
    <DictionaryRouteLoading
      headingId="server-management-loading-heading"
      className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8"
      rowClassName="h-32 rounded bg-inset"
      leading={<div className="h-24 rounded bg-inset" />}
      pick={(dictionary) => ({
        title: dictionary.serverManagement.listingDetails,
        loading: status,
      })}
    />
  );
}
