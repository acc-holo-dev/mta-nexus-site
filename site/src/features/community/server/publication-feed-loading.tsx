import { getRequestLocale } from "../../../lib/platform/i18n-server";
import { HonestLoadingShell } from "../../shell/honest-loading";
import { publicationCopy } from "../publication-feed-copy";

type PublicationFeedLoadingHeading = "title" | "activity" | "serverTitle";

export async function PublicationFeedLoading({
  heading = "title",
}: {
  heading?: PublicationFeedLoadingHeading;
} = {}) {
  const copy = publicationCopy(await getRequestLocale());
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      headingId="publication-feed-loading-heading"
      title={copy[heading]}
      loadingLabel={copy.loading}
      titleClassName="text-2xl font-bold text-primary"
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-10 rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-24 rounded bg-inset" />
        ))}
      </div>
    </HonestLoadingShell>
  );
}
