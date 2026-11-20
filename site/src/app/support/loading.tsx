import { DictionaryRouteLoading } from "../../features/shell/route-honest-loading-server";

export default function Loading() {
  return (
    <DictionaryRouteLoading
      headingId="support-loading-heading"
      className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8"
      leading={<div className="h-24 rounded bg-inset" />}
      pick={(dictionary) => ({
        title: dictionary.support.title,
        loading: dictionary.support.loading,
      })}
    />
  );
}
