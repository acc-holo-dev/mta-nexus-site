import { authorPublicationDeskCopy } from "../../../../lib/author-publication-desk-copy";
import { getRequestLocale } from "../../../../lib/i18n-server";

// Honest loading shell for /workspace/content/new.
export default async function Loading() {
  const copy = authorPublicationDeskCopy(await getRequestLocale());
  return (
    <section
      className="mx-auto max-w-3xl space-y-6"
      aria-busy="true"
      aria-labelledby="content-new-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="content-new-loading-heading" className="font-display text-primary">
          {copy.title}
        </h1>
        <p role="status" className="text-sm text-muted">
          {copy.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-11 rounded bg-inset" />
        <div className="h-64 rounded bg-inset" />
      </div>
    </section>
  );
}
