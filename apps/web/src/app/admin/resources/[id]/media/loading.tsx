import { getDictionary } from "../../../../../lib/i18n";
import { getRequestLocale } from "../../../../../lib/i18n-server";

// Honest loading shell for /admin/resources/[id]/media.
export default async function Loading() {
  const copy = getDictionary(await getRequestLocale()).admin;
  return (
    <section
      className="space-y-6"
      aria-busy="true"
      aria-labelledby="admin-resource-media-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="admin-resource-media-loading-heading" className="font-display text-primary">
          {copy.title}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {copy.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-10 w-72 rounded bg-inset" />
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
