import { getRequestLocale } from "../../../lib/i18n-server";
import { getLibraryCopy } from "../../../lib/library-view";

// Honest loading shell for /workspace/library.
export default async function Loading() {
  const copy = getLibraryCopy(await getRequestLocale());
  return (
    <section
      className="mx-auto max-w-5xl space-y-7 py-8"
      aria-busy="true"
      aria-labelledby="library-loading-heading"
    >
      <header className="space-y-3 border-b border-base pb-6">
        <h1 id="library-loading-heading" className="font-display text-primary">
          {copy.title}
        </h1>
        <p role="status" className="max-w-2xl text-sm text-secondary">
          {copy.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-10 w-48 rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-28 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
