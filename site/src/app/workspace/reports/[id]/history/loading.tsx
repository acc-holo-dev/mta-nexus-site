import { reportHistoryCopy } from "../../../../../features/community/community-report-history-copy";
import { HonestLoadingShell } from "../../../../../features/shell/honest-loading";
import { getRequestLocale } from "../../../../../lib/platform/i18n-server";

export default async function Loading() {
  const copy = reportHistoryCopy(await getRequestLocale());
  return (
    <HonestLoadingShell
      className="nexus-panel min-w-0 space-y-4 overflow-x-clip p-6"
      headingId="report-history-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      titleClassName="text-xl font-semibold text-primary"
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-6 w-2/3 rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </HonestLoadingShell>
  );
}
