import { HonestLoadingShell } from "../../../../../features/shell/honest-loading";
import { getDictionary } from "../../../../../lib/platform/i18n";
import { getRequestLocale } from "../../../../../lib/platform/i18n-server";

// Honest loading shell for /workspace/resources/[id]/moderation.
export default async function Loading() {
  const dictionary = getDictionary(await getRequestLocale());
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-5xl overflow-x-clip space-y-6 py-8"
      headingId="resource-moderation-loading-heading"
      title={dictionary.authorResources.title}
      loadingLabel={dictionary.authorResources.loading}
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
