import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n-server";

// Honest loading shell for /workspace/resources.
export default async function AuthorResourcesLoading() {
  const copy = getDictionary(await getRequestLocale()).authorResources;
  return (
    <section
      className="mx-auto max-w-5xl space-y-6"
      aria-busy="true"
      aria-labelledby="author-resources-loading-heading"
    >
      <header className="border-b border-base pb-6">
        <h1 id="author-resources-loading-heading" className="text-2xl font-extrabold text-primary">
          {copy.title}
        </h1>
        <p role="status" className="mt-2 text-sm text-muted">
          {copy.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-10 w-full max-w-lg rounded bg-inset" />
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="h-24 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
