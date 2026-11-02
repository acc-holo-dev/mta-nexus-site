import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n-server";

// Honest loading shell for /articles.
export default async function Loading() {
  const copy = getDictionary(await getRequestLocale()).articles;
  return (
    <section className="space-y-8" aria-busy="true" aria-labelledby="articles-loading-heading">
      <header className="space-y-2 border-b border-base pb-6">
        <h1
          id="articles-loading-heading"
          className="text-2xl font-extrabold text-primary sm:text-3xl"
        >
          {copy.title}
        </h1>
        <p role="status" className="text-sm text-muted">
          {copy.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-11 rounded bg-inset" />
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="h-28 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
