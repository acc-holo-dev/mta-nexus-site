import { DictionaryRouteLoading } from "../../../features/shell/route-honest-loading-server";

export default function Loading() {
  return (
    <DictionaryRouteLoading
      headingId="author-resources-loading-heading"
      className="mx-auto min-w-0 max-w-5xl overflow-x-clip space-y-6 py-8"
      rows={4}
      rowClassName="h-24 rounded bg-inset"
      leading={<div className="h-10 w-72 rounded bg-inset" />}
      pick={(dictionary) => ({
        title: dictionary.authorResources.title,
        loading: dictionary.authorResources.loading,
      })}
    />
  );
}
