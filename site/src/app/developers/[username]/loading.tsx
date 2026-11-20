import { DictionaryRouteLoading } from "../../../features/shell/route-honest-loading-server";

export default function Loading() {
  return (
    <DictionaryRouteLoading
      headingId="developer-loading-heading"
      className="min-w-0 space-y-6 overflow-x-clip"
      rows={0}
      leading={
        <>
          <div className="h-28 max-w-full rounded bg-inset" />
          <div className="h-40 max-w-full rounded bg-inset" />
        </>
      }
      pick={(dictionary) => ({
        title: dictionary.developers.creatorProfile,
        loading: dictionary.developers.loading,
      })}
    />
  );
}
