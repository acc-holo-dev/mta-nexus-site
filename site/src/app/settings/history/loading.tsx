import { getRequestLocale } from "../../../lib/i18n-server";
import { privateChangeHistoryCopy } from "../../../lib/private-change-history-copy";

export default async function Loading() {
  const copy = privateChangeHistoryCopy(await getRequestLocale());
  return (
    <section
      className="mx-auto min-w-0 max-w-5xl space-y-4 overflow-x-clip py-8"
      aria-busy="true"
      aria-labelledby="settings-history-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="settings-history-loading-heading" className="font-display text-primary">
          {copy.profileTitle}
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
