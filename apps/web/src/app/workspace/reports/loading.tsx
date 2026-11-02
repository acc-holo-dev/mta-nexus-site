import { communityReportCopy } from "../../../lib/community-report-copy";
import { getRequestLocale } from "../../../lib/i18n-server";

// Honest loading shell for /workspace/reports.
export default async function Loading() {
  const copy = communityReportCopy(await getRequestLocale());
  return (
    <section
      className="mx-auto max-w-4xl space-y-6"
      aria-busy="true"
      aria-labelledby="workspace-reports-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="workspace-reports-loading-heading" className="font-display text-primary">
          {copy.title}
        </h1>
        <p role="status" className="text-sm text-muted">
          {copy.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-11 rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-24 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
