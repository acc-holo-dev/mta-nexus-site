import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n-server";

// Honest loading shell for /developers.
export default async function Loading() {
  const copy = getDictionary(await getRequestLocale()).developers;
  return (
    <section className="space-y-6" aria-busy="true" aria-labelledby="developers-loading-heading">
      <header className="space-y-2 border-b border-base pb-6">
        <h1 id="developers-loading-heading" className="text-2xl font-extrabold text-primary">
          {copy.title}
        </h1>
        <p role="status" className="text-sm text-muted">
          {copy.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-11 rounded bg-inset" />
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="h-24 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
