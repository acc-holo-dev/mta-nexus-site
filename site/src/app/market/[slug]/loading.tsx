import { DictionaryRouteLoading } from "../../../features/shell/route-honest-loading-server";

export default function Loading() {
  return (
    <DictionaryRouteLoading
      headingId="market-resource-loading-heading"
      className="min-w-0 space-y-6 overflow-x-clip"
      rows={0}
      leading={
        <>
          <div className="h-48 rounded bg-inset" />
          <div className="h-8 w-64 max-w-full rounded bg-inset" />
          <div className="h-24 rounded bg-inset" />
          <div className="h-32 rounded bg-inset" />
        </>
      }
      pick={(dictionary) => ({
        title: dictionary.market.title,
        loading: dictionary.market.loading,
      })}
    />
  );
}
