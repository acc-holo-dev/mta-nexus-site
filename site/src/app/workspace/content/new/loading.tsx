import { AuthorPublicationDeskRouteLoading } from "../../../../features/community/author-publication-desk-route-loading-server";
import { pageShellMax3xlTight } from "../../../../features/shell/page-shell";

export default async function Loading() {
  return AuthorPublicationDeskRouteLoading({
    headingId: "content-new-loading-heading",
    className: pageShellMax3xlTight,
    rows: 0,
    leading: (
      <>
        <div className="h-11 rounded bg-inset" />
        <div className="h-64 rounded bg-inset" />
      </>
    ),
    titleKey: "title",
  });
}
