import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n-server";

// Honest loading shell for /community.
export default async function Loading() {
  const copy = getDictionary(await getRequestLocale()).community;
  return (
    <section
      className="min-w-0 space-y-6 overflow-x-clip"
      aria-busy="true"
      aria-labelledby="community-loading-heading"
    >
      <header className="space-y-2 border-b border-base pb-5">
        <h1 id="community-loading-heading" className="font-display text-primary">
          {copy.title}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {copy.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-11 rounded bg-inset" />
        {[1, 2, 3, 4, 5].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
