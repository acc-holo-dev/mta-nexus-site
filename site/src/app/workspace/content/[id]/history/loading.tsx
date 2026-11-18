import { authorPublicationDeskCopy } from "../../../../../features/community/author-publication-desk-copy";
import { HonestLoadingShell } from "../../../../../features/shell/honest-loading";
import { getRequestLocale } from "../../../../../lib/i18n/server";

// Honest loading shell for /workspace/content/[id]/history.
export default async function Loading() {
  const copy = authorPublicationDeskCopy(await getRequestLocale());
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      headingId="content-history-loading-heading"
      title={copy.history}
      loadingLabel={copy.loading}
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-10 w-64 rounded bg-inset" />
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </HonestLoadingShell>
  );
}
