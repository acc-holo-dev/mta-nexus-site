import { reportGroupsCopy } from "../../../../../lib/community-report-groups-copy";
import { getRequestLocale } from "../../../../../lib/i18n-server";

export default async function Loading() {
  const locale = await getRequestLocale();
  const copy = reportGroupsCopy(locale);
  return (
    <section
      className="mx-auto max-w-4xl space-y-6"
      aria-busy="true"
      aria-labelledby="admin-publication-reports-loading-heading"
    >
      <header className="space-y-2">
        <h1
          id="admin-publication-reports-loading-heading"
          className="text-2xl font-extrabold text-primary"
        >
          {copy.publicationTitle}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {copy.publicationLoading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-24 rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
