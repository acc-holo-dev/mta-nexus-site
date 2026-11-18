import { libraryCollectionsCopy } from "../../../../../features/library/library-collections-i18n";
import { HonestLoadingShell } from "../../../../../features/shell/honest-loading";
import { getRequestLocale } from "../../../../../lib/platform/i18n-server";

// Honest loading shell for /workspace/library/[id]/collections.
export default async function Loading() {
  const copy = libraryCollectionsCopy(await getRequestLocale());
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      headingId="resource-collections-loading-heading"
      title={copy.resourceCollections}
      loadingLabel={copy.loading}
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-10 w-64 rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-24 rounded bg-inset" />
        ))}
      </div>
    </HonestLoadingShell>
  );
}
