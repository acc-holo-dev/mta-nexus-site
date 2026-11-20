import { pageShellMax5xl } from "../../shell/page-shell";
import { LocaleCopyRouteLoading } from "../../shell/route-honest-loading-server";
import { publicationCopy } from "../publication-feed-copy";

type PublicationFeedLoadingHeading = "title" | "activity" | "serverTitle";

async function PublicationFeedLoading({
  heading = "title",
}: {
  heading?: PublicationFeedLoadingHeading;
} = {}) {
  return LocaleCopyRouteLoading({
    headingId: "publication-feed-loading-heading",
    className: pageShellMax5xl,
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

export async function PublicationFeedTitleLoading() {
  return PublicationFeedLoading({ heading: "title" });
}

export async function PublicationFeedActivityLoading() {
  return PublicationFeedLoading({ heading: "activity" });
}

export async function PublicationFeedServerTitleLoading() {
  return PublicationFeedLoading({ heading: "serverTitle" });
}
