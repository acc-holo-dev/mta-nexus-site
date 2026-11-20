import { DictionaryRouteLoading } from "../../features/shell/route-honest-loading-server";

export default function Loading() {
  return (
    <DictionaryRouteLoading
      headingId="terms-loading-heading"
      className="mx-auto min-w-0 max-w-3xl space-y-6 overflow-x-clip py-8"
      rows={0}
      leading={
        <>
          <div className="h-4 w-40 rounded bg-inset" />
          <div className="h-24 rounded bg-inset" />
          <div className="h-24 rounded bg-inset" />
          <div className="h-24 rounded bg-inset" />
        </>
      }
      pick={(dictionary) => ({
        title: dictionary.legal.terms.title,
        loading: dictionary.errors.loading,
      })}
    />
  );
}
