import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n-server";

// Honest loading shell for /organizations/[slug].
export default async function Loading() {
  const copy = getDictionary(await getRequestLocale()).organizations;
  return (
    <section
      className="min-w-0 space-y-6 overflow-x-clip"
      aria-busy="true"
      aria-labelledby="organization-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="organization-loading-heading" className="font-display text-primary">
          {copy.title}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {copy.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-28 max-w-full rounded bg-inset" />
        <div className="h-40 max-w-full rounded bg-inset" />
        <div className="h-32 max-w-full rounded bg-inset" />
      </div>
    </section>
  );
}
