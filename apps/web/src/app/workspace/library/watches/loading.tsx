import { getRequestLocale } from "../../../../lib/i18n-server";
import { resourceReleaseWatchesCopy } from "../../../../lib/resource-release-watches-i18n";

// Honest loading shell for /workspace/library/watches.
export default async function Loading() {
  const copy = resourceReleaseWatchesCopy(await getRequestLocale());
  return (
    <section
      className="mx-auto max-w-5xl space-y-6"
      aria-busy="true"
      aria-labelledby="release-watches-loading-heading"
    >
      <header className="border-b border-base pb-6">
        <h1 id="release-watches-loading-heading" className="font-display text-primary">
          {copy.title}
        </h1>
        <p role="status" className="mt-2 text-sm text-muted">
          {copy.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-28 rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-24 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
