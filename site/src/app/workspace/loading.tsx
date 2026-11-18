import { HonestLoadingShell } from "../../features/shell/honest-loading";
import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n/server";

// Honest loading shell for /workspace.
export default async function Loading() {
  const copy = getDictionary(await getRequestLocale()).workspace;
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      headingId="workspace-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      headerClassName="min-w-0 space-y-2"
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-28 rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </HonestLoadingShell>
  );
}
