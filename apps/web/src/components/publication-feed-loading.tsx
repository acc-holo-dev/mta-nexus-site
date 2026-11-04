import { getRequestLocale } from "../lib/i18n-server";
import { publicationCopy } from "../lib/publication-feed-copy";

type PublicationFeedLoadingHeading = "title" | "activity" | "serverTitle";

export async function PublicationFeedLoading({
  heading = "title",
}: {
  heading?: PublicationFeedLoadingHeading;
} = {}) {
  const copy = publicationCopy(await getRequestLocale());
  return (
    <section
      className="min-w-0 space-y-6 overflow-x-clip"
      aria-busy="true"
      aria-labelledby="publication-feed-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="publication-feed-loading-heading" className="text-2xl font-bold text-primary">
          {copy[heading]}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {copy.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-10 rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-24 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
