import { getRequestLocale } from "../../../../../../../lib/i18n-server";
import { serverPublicationHistoryCopy } from "../../../../../../../lib/server-publication-history-copy";

export default async function Loading() {
  const copy = serverPublicationHistoryCopy(await getRequestLocale());
  return (
    <section
      className="mx-auto min-w-0 max-w-4xl space-y-4 overflow-x-clip py-8"
      aria-busy="true"
      aria-labelledby="content-history-loading-heading"
    >
      <h1 id="content-history-loading-heading" className="text-xl font-semibold text-primary">
        {copy.title}
      </h1>
      <p role="status" aria-live="polite" className="text-sm text-muted">
        {copy.loading}
      </p>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-6 w-2/3 rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
