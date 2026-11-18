import { getLibraryCopy } from "../../../features/library/library-view";
import { HonestLoadingShell } from "../../../features/shell/honest-loading";
import { getRequestLocale } from "../../../lib/platform/i18n-server";

// Honest loading shell for /workspace/library.
export default async function Loading() {
  const copy = getLibraryCopy(await getRequestLocale());
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      headingId="library-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-10 w-72 rounded bg-inset" />
        <div className="h-24 rounded bg-inset" />
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="h-28 rounded bg-inset" />
        ))}
      </div>
    </HonestLoadingShell>
  );
}
