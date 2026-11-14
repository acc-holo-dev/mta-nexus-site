import { getRequestLocale } from "../../../../lib/i18n-server";
import { getOrganizationCopy } from "../../../../lib/organization-workspace-copy";

// Honest loading shell for /workspace/organizations/new.
export default async function Loading() {
  const copy = getOrganizationCopy(await getRequestLocale());
  return (
    <section
      className="mx-auto min-w-0 max-w-3xl space-y-5 overflow-x-clip py-8"
      aria-busy="true"
      aria-labelledby="org-new-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="org-new-loading-heading" className="font-display text-primary">
          {copy.create}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {copy.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-10 w-2/3 max-w-md rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-24 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
