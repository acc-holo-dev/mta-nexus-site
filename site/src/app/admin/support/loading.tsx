import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n-server";

// Honest loading shell for /admin/support.
export default async function Loading() {
  const copy = getDictionary(await getRequestLocale()).support;
  return (
    <section
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip"
      aria-busy="true"
      aria-labelledby="admin-support-loading-heading"
    >
      <header className="space-y-2 border-b border-base pb-6">
        <h1 id="admin-support-loading-heading" className="font-display text-primary">
          {copy.staffQueue}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {copy.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-28 rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
