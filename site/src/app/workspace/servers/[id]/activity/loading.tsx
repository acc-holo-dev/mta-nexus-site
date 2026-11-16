import { getRequestLocale } from "../../../../../lib/i18n-server";
import { getServerActivityCopy } from "../../../../../lib/server-activity-view";

export default async function Loading() {
  const copy = getServerActivityCopy(await getRequestLocale());
  return (
    <section
      className="mx-auto min-w-0 max-w-4xl space-y-4 overflow-x-clip py-8"
      aria-busy="true"
      aria-labelledby="server-activity-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="server-activity-loading-heading" className="text-xl font-semibold text-primary">
          {copy.title}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {copy.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-6 w-2/3 rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
