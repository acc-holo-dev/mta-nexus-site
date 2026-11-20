import { AuthorPublicationDeskRouteLoading } from "../../../features/community/author-publication-desk-route-loading-server";

export default async function Loading() {
  return AuthorPublicationDeskRouteLoading({
    headingId: "publication-desk-loading-heading",
    leading: <div className="h-32 rounded bg-inset" />,
    titleKey: "title",
  });
}
