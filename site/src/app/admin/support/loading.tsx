import { DictionaryRouteLoading } from "../../../features/shell/route-honest-loading-server";

export default function Loading() {
  return (
    <DictionaryRouteLoading
      headingId="admin-support-loading-heading"
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip"
      headerClassName="space-y-2 border-b border-base pb-6"
      leading={<div className="h-28 rounded bg-inset" />}
      pick={(dictionary) => ({
        title: dictionary.support.staffQueue,
        loading: dictionary.support.loading,
      })}
    />
  );
}
