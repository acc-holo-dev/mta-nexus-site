import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n-server";

// Honest loading shell for /community/new.
export default async function Loading() {
  const copy = getDictionary(await getRequestLocale()).community;
  return (
    <section className="space-y-6" aria-busy="true" aria-labelledby="community-new-loading-heading">
      <header className="space-y-2">
        <h1 id="community-new-loading-heading" className="font-display text-primary">
          {copy.startTitle}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {copy.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-11 rounded bg-inset" />
        <div className="h-40 rounded bg-inset" />
        <div className="h-28 rounded bg-inset" />
      </div>
    </section>
  );
}
