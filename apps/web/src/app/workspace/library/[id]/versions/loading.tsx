import { getRequestLocale } from "../../../../../lib/i18n-server";
import { getResourceReleaseControlCopy } from "../../../../../lib/resource-release-control-i18n";

// Honest loading shell for /workspace/library/[id]/versions.
export default async function Loading() {
  const copy = getResourceReleaseControlCopy(await getRequestLocale());
  return (
    <section
      className="mx-auto max-w-5xl space-y-6 py-8"
      aria-busy="true"
      aria-labelledby="library-versions-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="library-versions-loading-heading" className="font-display text-primary">
          {copy.versions}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {copy.updatesLoading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-10 w-64 rounded bg-inset" />
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="h-24 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
