import { AuthorPublicationDeskRouteLoading } from "../../../../features/community/author-publication-desk-route-loading-server";

export default async function Loading() {
  return AuthorPublicationDeskRouteLoading({
    headingId: "content-new-loading-heading",
    className: "mx-auto min-w-0 max-w-3xl space-y-6 overflow-x-clip",
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
