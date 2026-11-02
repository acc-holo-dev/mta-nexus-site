import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n-server";

// Honest loading shell for /settings.
export default async function Loading() {
  const dictionary = getDictionary(await getRequestLocale());
  return (
    <section
      className="mx-auto max-w-3xl space-y-6 py-8"
      aria-busy="true"
      aria-labelledby="settings-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="settings-loading-heading" className="font-display text-primary">
          {dictionary.settings.title}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {dictionary.settings.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-28 rounded bg-inset" />
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="h-24 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
