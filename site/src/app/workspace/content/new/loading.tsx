import { authorPublicationDeskCopy } from "../../../../features/community/author-publication-desk-copy";
import { HonestLoadingShell } from "../../../../features/shell/honest-loading";
import { getRequestLocale } from "../../../../lib/platform/i18n-server";

// Honest loading shell for /workspace/content/new.
export default async function Loading() {
  const copy = authorPublicationDeskCopy(await getRequestLocale());
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-3xl space-y-6 overflow-x-clip"
      headingId="content-new-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-11 rounded bg-inset" />
        <div className="h-64 rounded bg-inset" />
      </div>
    </HonestLoadingShell>
  );
}
