import { getRequestLocale } from "../../../lib/i18n-server";
import { getOrganizationCopy } from "../../../lib/organization-workspace-copy";

// Honest loading shell for /workspace/organizations.
export default async function Loading() {
  const copy = getOrganizationCopy(await getRequestLocale());
  return (
    <section
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      aria-busy="true"
      aria-labelledby="organizations-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="organizations-loading-heading" className="font-display text-primary">
          {copy.title}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {copy.listLoading}
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
