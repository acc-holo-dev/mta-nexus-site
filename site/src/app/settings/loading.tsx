import { DictionaryRouteLoading } from "../../features/shell/route-honest-loading-server";

export default function SettingsLoading() {
  return (
    <DictionaryRouteLoading
      headingId="settings-loading-heading"
      className="mx-auto min-w-0 max-w-3xl space-y-8 overflow-x-clip"
      headerClassName=""
      statusClassName="mt-1 font-caption text-muted"
      rows={0}
      leading={
        <>
          <div className="h-4 w-1/3 rounded bg-inset" />
          <div className="h-20 rounded bg-inset" />
        </>
      }
      pick={(dictionary) => ({
        title: dictionary.settings.title,
        loading: dictionary.settings.loading,
      })}
    />
  );
}
