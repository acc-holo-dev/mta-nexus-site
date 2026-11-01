import { authorPublicationDeskCopy } from "../../../lib/author-publication-desk-copy";
import { getRequestLocale } from "../../../lib/i18n-server";

// Honest loading shell for /workspace/content.
export default async function AuthorPublicationLoading() {
  const copy = authorPublicationDeskCopy(await getRequestLocale());
  return (
    <section
      className="mx-auto max-w-5xl space-y-6"
      aria-busy="true"
      aria-labelledby="publication-desk-loading-heading"
    >
      <header className="border-b border-base pb-6">
        <h1 id="publication-desk-loading-heading" className="text-2xl font-extrabold text-primary">
          {copy.title}
        </h1>
        <p role="status" className="mt-2 text-sm text-muted">
          {copy.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-32 rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-24 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
