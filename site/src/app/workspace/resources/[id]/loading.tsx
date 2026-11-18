import { HonestLoadingShell } from "../../../../features/shell/honest-loading";
import { getDictionary } from "../../../../lib/platform/i18n";
import { getRequestLocale } from "../../../../lib/platform/i18n-server";

// Honest loading shell for /workspace/resources/[id].
export default async function Loading() {
  const copy = getDictionary(await getRequestLocale()).authorResources;
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-5xl overflow-x-clip space-y-6"
      headingId="author-resource-loading-heading"
      title={copy.edit}
      loadingLabel={copy.loading}
      headerClassName="border-b border-base pb-6"
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
