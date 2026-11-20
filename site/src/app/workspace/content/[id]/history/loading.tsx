import { AuthorPublicationDeskRouteLoading } from "../../../../../features/community/author-publication-desk-route-loading-server";

export default async function Loading() {
  return AuthorPublicationDeskRouteLoading({
    headingId: "content-history-loading-heading",
    className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8",
    rows: 4,
    titleKey: "history",
  });
}
