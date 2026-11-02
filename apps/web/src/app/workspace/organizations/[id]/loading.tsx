import { getRequestLocale } from "../../../../lib/i18n-server";
import { getOrganizationCopy } from "../../../../lib/organization-workspace-copy";

// Honest loading shell for /workspace/organizations/[id].
export default async function Loading() {
  const copy = getOrganizationCopy(await getRequestLocale());
  return (
    <section className="space-y-5" aria-busy="true" aria-labelledby="organization-loading-heading">
      <header className="space-y-2">
        <h1 id="organization-loading-heading" className="font-display text-primary">
          {copy.profile}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {copy.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-10 w-2/3 max-w-md rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-28 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
