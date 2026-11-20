import { DictionaryRouteLoading } from "../../features/shell/route-honest-loading-server";

export default function Loading() {
  return (
    <DictionaryRouteLoading
      headingId="security-loading-heading"
      className="mx-auto min-w-0 max-w-3xl space-y-6 overflow-x-clip py-8"
      leading={<div className="h-28 rounded bg-inset" />}
      pick={(dictionary) => ({
        title: dictionary.securityCenter.title,
        loading: dictionary.securityCenter.loading,
      })}
    />
  );
}
