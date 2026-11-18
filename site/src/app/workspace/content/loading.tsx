import { authorPublicationDeskCopy } from "../../../features/community/author-publication-desk-copy";
import { HonestLoadingShell } from "../../../features/shell/honest-loading";
import { getRequestLocale } from "../../../lib/platform/i18n-server";

// Honest loading shell for /workspace/content.
export default async function AuthorPublicationLoading() {
  const copy = authorPublicationDeskCopy(await getRequestLocale());
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip"
      headingId="publication-desk-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      headerClassName="border-b border-base pb-6"
      titleClassName="text-2xl font-extrabold text-primary"
      statusClassName="mt-2 text-sm text-muted"
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-32 rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-24 rounded bg-inset" />
        ))}
      </div>
    </HonestLoadingShell>
  );
}
