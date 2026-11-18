import { getReleaseHistoryCopy } from "../../../../features/resources/public-release-history";
import { HonestLoadingShell } from "../../../../features/shell/honest-loading";
import { getRequestLocale } from "../../../../lib/i18n/server";

// Honest loading shell for /market/[slug]/versions.
export default async function Loading() {
  const copy = getReleaseHistoryCopy(await getRequestLocale());
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      headingId="market-versions-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="h-16 rounded bg-inset" />
        ))}
      </div>
    </HonestLoadingShell>
  );
}
