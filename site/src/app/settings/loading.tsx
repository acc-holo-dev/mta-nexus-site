import { HonestLoadingShell } from "../../features/shell/honest-loading";
import { getDictionary } from "../../lib/platform/i18n";
import { getRequestLocale } from "../../lib/platform/i18n-server";

export default async function SettingsLoading() {
  const locale = await getRequestLocale();
  const copy = getDictionary(locale).settings;
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-3xl space-y-8 overflow-x-clip"
      headingId="settings-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      headerClassName=""
      statusClassName="mt-1 font-caption text-muted"
    >
      <div className="animate-pulse space-y-8" aria-hidden="true">
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="nexus-panel space-y-4 p-5 shadow-nexus-sm">
            <div className="h-4 w-1/3 rounded bg-inset" />
            <div className="h-20 rounded bg-inset" />
          </div>
        ))}
      </div>
    </HonestLoadingShell>
  );
}
