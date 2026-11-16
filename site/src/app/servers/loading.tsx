import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n-server";

// Honest loading shell for /servers.
export default async function Loading() {
  const dictionary = getDictionary(await getRequestLocale());
  return (
    <section
      className="min-w-0 space-y-8 overflow-x-clip"
      aria-busy="true"
      aria-labelledby="servers-loading-heading"
    >
      <header className="space-y-2 border-b border-base pb-6">
        <h1
          id="servers-loading-heading"
          className="text-2xl font-extrabold text-primary sm:text-3xl"
        >
          {dictionary.servers.title}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {dictionary.servers.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-11 rounded bg-inset" />
        {[1, 2, 3, 4, 5].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
