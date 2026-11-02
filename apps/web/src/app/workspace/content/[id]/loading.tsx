import { authorPublicationDeskCopy } from "../../../../lib/author-publication-desk-copy";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { getUserPlatformCopy } from "../../../../lib/user-platform-copy";

// Honest loading shell for /workspace/content/[id].
export default async function Loading() {
  const locale = await getRequestLocale();
  const copy = getUserPlatformCopy(locale);
  const desk = authorPublicationDeskCopy(locale);
  return (
    <section
      className="mx-auto max-w-3xl space-y-6"
      aria-busy="true"
      aria-labelledby="edit-publication-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="edit-publication-loading-heading" className="font-display text-primary">
          {copy.edit}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {desk.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-10 w-40 rounded bg-inset" />
        <div className="h-32 rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-16 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
