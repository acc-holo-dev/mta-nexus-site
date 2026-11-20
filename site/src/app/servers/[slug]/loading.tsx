import { DictionaryRouteLoading } from "../../../features/shell/route-honest-loading-server";

export default function Loading() {
  return (
    <DictionaryRouteLoading
      headingId="server-detail-loading-heading"
      className="min-w-0 space-y-6 overflow-x-clip"
      rows={0}
      leading={
        <>
          <div className="h-32 rounded bg-inset" />
          <div className="h-24 rounded bg-inset" />
          <div className="h-40 rounded bg-inset" />
        </>
      }
      pick={(dictionary) => ({
        title: dictionary.serverDetail.breadcrumb,
        loading: dictionary.serverDetail.loading,
      })}
    />
  );
}
