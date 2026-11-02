import { getDictionary } from "../../../../../lib/i18n";
import { getRequestLocale } from "../../../../../lib/i18n-server";

// Honest loading shell for /workspace/resources/[id]/media.
export default async function Loading() {
  const dictionary = getDictionary(await getRequestLocale());
  return (
    <section
      className="mx-auto max-w-5xl space-y-6 py-8"
      aria-busy="true"
      aria-labelledby="resource-media-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="resource-media-loading-heading" className="font-display text-primary">
          {dictionary.authorResources.title}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {dictionary.authorResources.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-10 w-64 rounded bg-inset" />
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
