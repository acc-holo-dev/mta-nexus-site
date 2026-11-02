import { reportGroupsCopy } from "../../../../lib/community-report-groups-copy";
import { getRequestLocale } from "../../../../lib/i18n-server";

// Honest loading shell for /admin/reports/targets.
export default async function Loading() {
  const copy = reportGroupsCopy(await getRequestLocale());
  return (
    <section
      className="mx-auto max-w-5xl space-y-6"
      aria-busy="true"
      aria-labelledby="report-groups-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="report-groups-loading-heading" className="font-display text-primary">
          {copy.title}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {copy.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-32 rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
