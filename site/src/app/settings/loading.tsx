import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n-server";

export default async function SettingsLoading() {
  const locale = await getRequestLocale();
  const copy = getDictionary(locale).settings;
  return (
    <section
      className="mx-auto min-w-0 max-w-3xl space-y-8 overflow-x-clip"
      aria-busy="true"
      aria-labelledby="settings-loading-heading"
    >
      <header>
        <h1 id="settings-loading-heading" className="font-display text-primary">
          {copy.title}
        </h1>
        <p role="status" aria-live="polite" className="mt-1 font-caption text-muted">
          {copy.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-8" aria-hidden="true">
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="nexus-panel space-y-4 p-5 shadow-nexus-sm">
            <div className="h-4 w-1/3 rounded bg-inset" />
            <div className="h-20 rounded bg-inset" />
          </div>
        ))}
      </div>
    </section>
  );
}
