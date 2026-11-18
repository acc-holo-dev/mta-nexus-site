import { HonestLoadingShell } from "../../features/shell/honest-loading";
import { getDictionary } from "../../lib/platform/i18n";
import { getRequestLocale } from "../../lib/platform/i18n-server";

// Honest loading shell for /discover.
export default async function Loading() {
  const copy = getDictionary(await getRequestLocale()).discover;
  return (
    <HonestLoadingShell
      className="min-w-0 space-y-6 overflow-x-clip"
      headingId="discover-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-11 rounded bg-inset" />
        <div className="h-10 w-96 max-w-full rounded bg-inset" />
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="h-24 rounded bg-inset" />
        ))}
      </div>
    </HonestLoadingShell>
  );
}
