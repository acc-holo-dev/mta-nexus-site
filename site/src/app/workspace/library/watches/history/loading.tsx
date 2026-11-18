import { resourceReleaseWatchHistoryCopy } from "../../../../../features/resources/resource-release-watch-history-i18n";
import { HonestLoadingShell } from "../../../../../features/shell/honest-loading";
import { getRequestLocale } from "../../../../../lib/i18n/server";

// Honest loading shell for /workspace/library/watches/history.
export default async function Loading() {
  const copy = resourceReleaseWatchHistoryCopy(await getRequestLocale());
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip"
      headingId="release-watch-history-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      headerClassName="border-b border-base pb-6"
      statusClassName="mt-2 text-sm text-muted"
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-28 rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-24 rounded bg-inset" />
        ))}
      </div>
    </HonestLoadingShell>
  );
}
