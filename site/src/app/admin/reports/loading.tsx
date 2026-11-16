import { communityReportCopy } from "../../../lib/community-report-copy";
import { getRequestLocale } from "../../../lib/i18n-server";

// Honest loading shell for /admin/reports.
export default async function Loading() {
  const copy = communityReportCopy(await getRequestLocale());
  return (
    <section
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip"
      aria-busy="true"
      aria-labelledby="admin-reports-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="admin-reports-loading-heading" className="font-display text-primary">
          {copy.queue}
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
