import { DictionaryRouteLoading } from "../../features/shell/route-honest-loading-server";

export default function Loading() {
  return (
    <DictionaryRouteLoading
      headingId="discover-loading-heading"
      className="min-w-0 space-y-6 overflow-x-clip"
      rows={4}
      rowClassName="h-24 rounded bg-inset"
      leading={
        <>
          <div className="h-11 rounded bg-inset" />
          <div className="h-10 w-96 max-w-full rounded bg-inset" />
        </>
      }
      pick={(dictionary) => ({
        title: dictionary.discover.title,
        loading: dictionary.discover.loading,
      })}
    />
  );
}
