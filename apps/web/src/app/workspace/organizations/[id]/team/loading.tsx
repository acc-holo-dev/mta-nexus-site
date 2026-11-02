import { getRequestLocale } from "../../../../../lib/i18n-server";
import { organizationTeamCopy } from "../../../../../lib/organization-team-copy";

export default async function Loading() {
  const copy = organizationTeamCopy(await getRequestLocale());
  return (
    <section
      className="nexus-panel space-y-4 p-6"
      aria-busy="true"
      aria-labelledby="organization-team-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="organization-team-loading-heading" className="text-xl font-semibold text-primary">
          {copy.title}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {copy.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-6 w-2/3 rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-16 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
