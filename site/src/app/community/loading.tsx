import { DictionaryRouteLoading } from "../../features/shell/route-honest-loading-server";

export default function Loading() {
  return (
    <DictionaryRouteLoading
      headingId="community-loading-heading"
      className="min-w-0 space-y-6 overflow-x-clip"
      headerClassName="space-y-2 border-b border-base pb-5"
      rows={5}
      leading={<div className="h-11 rounded bg-inset" />}
      pick={(dictionary) => ({
        title: dictionary.community.title,
        loading: dictionary.community.loading,
      })}
    />
  );
}
