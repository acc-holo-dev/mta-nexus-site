import { getResourceReleaseControlCopy } from "../../../../features/library/resource-release-control-i18n";
import { HonestLoadingShell } from "../../../../features/shell/honest-loading";
import { getRequestLocale } from "../../../../lib/platform/i18n-server";

// Honest loading shell for /workspace/library/updates.
export default async function Loading() {
  const copy = getResourceReleaseControlCopy(await getRequestLocale());
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      headingId="library-updates-loading-heading"
      title={copy.updates}
      loadingLabel={copy.updatesLoading}
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-12 rounded bg-inset" />
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="h-32 rounded bg-inset" />
        ))}
      </div>
    </HonestLoadingShell>
  );
}
