import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n-server";

// Honest loading shell for /settings.
export default async function SettingsLoading() {
  const copy = getDictionary(await getRequestLocale()).settings;
  return (
    <section
      className="mx-auto max-w-3xl space-y-6"
      aria-busy="true"
      aria-labelledby="settings-loading-heading"
    >
      <header className="border-b border-base pb-6">
        <h1 id="settings-loading-heading" className="text-2xl font-extrabold text-primary">
          {copy.title}
        </h1>
        <p role="status" className="mt-2 text-sm text-muted">
          {copy.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-10 w-full max-w-md rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="nexus-panel h-32 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
