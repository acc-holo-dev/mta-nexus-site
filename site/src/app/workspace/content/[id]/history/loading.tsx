import { AuthorPublicationDeskRouteLoading } from "../../../../../features/community/author-publication-desk-route-loading-server";
import { pageShellMax5xl } from "../../../../../features/shell/page-shell";

export default async function Loading() {
  return AuthorPublicationDeskRouteLoading({
    headingId: "content-history-loading-heading",
    className: pageShellMax5xl,
    rows: 4,
    titleKey: "history",
  });
}
