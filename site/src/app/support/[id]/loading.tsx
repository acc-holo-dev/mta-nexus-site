import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n-server";

// Honest loading shell for /support/[id].
export default async function Loading() {
  const copy = getDictionary(await getRequestLocale()).support;
  return (
    <section
      className="min-w-0 space-y-6 overflow-x-clip"
      aria-busy="true"
      aria-labelledby="support-case-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="support-case-loading-heading" className="font-display text-primary">
          {copy.title}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {copy.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-24 rounded bg-inset" />
        <div className="h-40 rounded bg-inset" />
        <div className="h-28 rounded bg-inset" />
      </div>
    </section>
  );
}
