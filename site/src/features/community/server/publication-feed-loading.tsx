import { getRequestLocale } from "../../../lib/i18n/server";
import { RouteHonestLoading } from "../../shell/route-honest-loading-server";
import { publicationCopy } from "../publication-feed-copy";

type PublicationFeedLoadingHeading = "title" | "activity" | "serverTitle";

export async function PublicationFeedLoading({
  heading = "title",
}: {
  heading?: PublicationFeedLoadingHeading;
} = {}) {
  const copy = publicationCopy(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="publication-feed-loading-heading"
      title={copy[heading]}
      loadingLabel={copy.loading}
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      titleClassName="text-2xl font-bold text-primary"
      rowClassName="h-24 rounded bg-inset"
      leading={<div className="h-10 rounded bg-inset" />}
    />
  );
}
