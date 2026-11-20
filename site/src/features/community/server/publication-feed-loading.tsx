import { LocaleCopyRouteLoading } from "../../shell/route-honest-loading-server";
import { publicationCopy } from "../publication-feed-copy";

type PublicationFeedLoadingHeading = "title" | "activity" | "serverTitle";

export async function PublicationFeedLoading({
  heading = "title",
}: {
  heading?: PublicationFeedLoadingHeading;
} = {}) {
  return LocaleCopyRouteLoading({
    headingId: "publication-feed-loading-heading",
    className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8",
    titleClassName: "text-2xl font-bold text-primary",
    rowClassName: "h-24 rounded bg-inset",
    leading: <div className="h-10 rounded bg-inset" />,
    load: (locale) => {
      const copy = publicationCopy(locale);
      return {
        title: copy[heading],
        loading: copy.loading,
      };
    },
  });
}
