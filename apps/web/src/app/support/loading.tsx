import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n-server";

// Honest loading shell for /support.
export default async function Loading() {
  const dictionary = getDictionary(await getRequestLocale());
  return (
    <section
      className="mx-auto max-w-4xl space-y-6 py-8"
      aria-busy="true"
      aria-labelledby="support-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="support-loading-heading" className="font-display text-primary">
          {dictionary.support.title}
        </h1>
        <p role="status" className="text-sm text-muted">
          {dictionary.support.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-24 rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
