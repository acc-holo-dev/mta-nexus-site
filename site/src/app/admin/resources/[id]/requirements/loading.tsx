import { getDictionary } from "../../../../../lib/i18n";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { resourceRequirementsCopy } from "../../../../../lib/resource-requirements-i18n";

// Honest loading shell for /admin/resources/[id]/requirements.
export default async function Loading() {
  const locale = await getRequestLocale();
  const copy = resourceRequirementsCopy(locale);
  const admin = getDictionary(locale).admin;
  return (
    <section
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      aria-busy="true"
      aria-labelledby="admin-resource-requirements-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="admin-resource-requirements-loading-heading" className="font-display text-primary">
          {copy.title}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {admin.loading}
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
