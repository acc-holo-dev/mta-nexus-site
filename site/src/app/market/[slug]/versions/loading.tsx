import { getRequestLocale } from "../../../../lib/i18n-server";
import { getReleaseHistoryCopy } from "../../../../lib/public-release-history";

// Honest loading shell for /market/[slug]/versions.
export default async function Loading() {
  const copy = getReleaseHistoryCopy(await getRequestLocale());
  return (
    <section
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      aria-busy="true"
      aria-labelledby="market-versions-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="market-versions-loading-heading" className="font-display text-primary">
          {copy.title}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {copy.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="h-16 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
