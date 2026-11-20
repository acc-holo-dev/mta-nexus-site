import { DictionaryRouteLoading } from "../../features/shell/route-honest-loading-server";

export default function Loading() {
  return (
    <DictionaryRouteLoading
      headingId="workspace-loading-heading"
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      headerClassName="min-w-0 space-y-2"
      leading={<div className="h-28 rounded bg-inset" />}
      pick={(dictionary) => ({
        title: dictionary.workspace.title,
        loading: dictionary.workspace.loading,
      })}
    />
  );
}
