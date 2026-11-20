import { RouteHonestLoading } from "../../features/shell/route-honest-loading-server";
import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n/server";

export default async function SettingsLoading() {
  const locale = await getRequestLocale();
  const copy = getDictionary(locale).settings;
  return (
    <RouteHonestLoading
      headingId="settings-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
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
    />
  );
}
