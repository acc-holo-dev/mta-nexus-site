import { DictionaryRouteLoading } from "../../features/shell/route-honest-loading-server";

export default function Loading() {
  return (
    <DictionaryRouteLoading
      headingId="servers-loading-heading"
      className="min-w-0 space-y-8 overflow-x-clip"
      rows={5}
      leading={<div className="h-11 rounded bg-inset" />}
      pick={(dictionary) => ({
        title: dictionary.servers.title,
        loading: dictionary.servers.loading,
      })}
    />
  );
}
