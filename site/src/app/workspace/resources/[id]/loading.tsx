import { getDictionary } from "../../../../lib/i18n";
import { getRequestLocale } from "../../../../lib/i18n-server";

// Honest loading shell for /workspace/resources/[id].
export default async function Loading() {
  const copy = getDictionary(await getRequestLocale()).authorResources;
  return (
    <section
      className="mx-auto min-w-0 max-w-5xl overflow-x-clip space-y-6"
      aria-busy="true"
      aria-labelledby="author-resource-loading-heading"
    >
      <header className="border-b border-base pb-6">
        <h1 id="author-resource-loading-heading" className="font-display text-primary">
          {copy.edit}
        </h1>
        <p role="status" aria-live="polite" className="mt-2 text-sm text-muted">
          {copy.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-32 rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-24 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
