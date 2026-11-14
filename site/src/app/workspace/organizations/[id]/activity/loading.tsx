import { getRequestLocale } from "../../../../../lib/i18n-server";
import { organizationGovernanceCopy } from "../../../../../lib/organization-governance-copy";

export default async function Loading() {
  const copy = organizationGovernanceCopy(await getRequestLocale());
  return (
    <section
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      aria-busy="true"
      aria-labelledby="organization-activity-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="organization-activity-loading-heading" className="font-display text-primary">
          {copy.history}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {copy.historyDescription}
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
