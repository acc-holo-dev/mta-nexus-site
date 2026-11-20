import { DictionaryRouteLoading } from "../../../../../features/shell/route-honest-loading-server";

export default function Loading() {
  return (
    <DictionaryRouteLoading
      headingId="resource-media-loading-heading"
      className="mx-auto min-w-0 max-w-5xl overflow-x-clip space-y-6 py-8"
      rows={4}
      leading={<div className="h-10 w-64 rounded bg-inset" />}
      pick={(dictionary) => ({
        title: dictionary.authorResources.title,
        loading: dictionary.authorResources.loading,
      })}
    />
  );
}
