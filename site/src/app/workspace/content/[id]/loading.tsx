import { authorPublicationDeskCopy } from "../../../../features/community/author-publication-desk-copy";
import { getUserPlatformCopy } from "../../../../features/community/user-platform-copy";
import { HonestLoadingShell } from "../../../../features/shell/honest-loading";
import { getRequestLocale } from "../../../../lib/i18n/server";

// Honest loading shell for /workspace/content/[id].
export default async function Loading() {
  const locale = await getRequestLocale();
  const copy = getUserPlatformCopy(locale);
  const desk = authorPublicationDeskCopy(locale);
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-3xl space-y-6 overflow-x-clip"
      headingId="edit-publication-loading-heading"
      title={copy.edit}
      loadingLabel={desk.loading}
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-10 w-40 rounded bg-inset" />
        <div className="h-32 rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-16 rounded bg-inset" />
        ))}
      </div>
    </HonestLoadingShell>
  );
}
