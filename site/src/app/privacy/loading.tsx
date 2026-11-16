import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n-server";

// Honest loading shell for /privacy.
export default async function Loading() {
  const dictionary = getDictionary(await getRequestLocale());
  return (
    <section
      className="mx-auto min-w-0 max-w-3xl space-y-6 overflow-x-clip py-8"
      aria-busy="true"
      aria-labelledby="privacy-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="privacy-loading-heading" className="font-display text-primary">
          {dictionary.legal.privacy.title}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {dictionary.errors.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-4 w-40 rounded bg-inset" />
        <div className="h-24 rounded bg-inset" />
        <div className="h-24 rounded bg-inset" />
        <div className="h-24 rounded bg-inset" />
      </div>
    </section>
  );
}
