import { HonestLoadingShell } from "../../../features/shell/honest-loading";
import { getDictionary } from "../../../lib/platform/i18n";
import { getRequestLocale } from "../../../lib/platform/i18n-server";

// Honest loading shell for /workspace/resources.
export default async function Loading() {
  const copy = getDictionary(await getRequestLocale()).authorResources;
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-5xl overflow-x-clip space-y-6 py-8"
      headingId="author-resources-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-10 w-72 rounded bg-inset" />
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="h-24 rounded bg-inset" />
        ))}
      </div>
    </HonestLoadingShell>
  );
}
