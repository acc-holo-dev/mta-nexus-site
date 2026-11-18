import { resourceReleaseWatchesCopy } from "../../../../../../features/resources/resource-release-watches-i18n";
import { HonestLoadingShell } from "../../../../../../features/shell/honest-loading";
import { getRequestLocale } from "../../../../../../lib/i18n/server";

// Honest loading shell for /workspace/library/collections/[id]/watches.
export default async function Loading() {
  const copy = resourceReleaseWatchesCopy(await getRequestLocale());
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      headingId="collection-watches-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-10 w-72 rounded bg-inset" />
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </HonestLoadingShell>
  );
}
