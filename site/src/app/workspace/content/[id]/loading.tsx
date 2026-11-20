import { AuthorPublicationDeskRouteLoading } from "../../../../features/community/author-publication-desk-route-loading-server";
import { getUserPlatformCopy } from "../../../../features/community/user-platform-copy";

export default async function Loading() {
  return AuthorPublicationDeskRouteLoading({
    headingId: "edit-publication-loading-heading",
    className: "mx-auto min-w-0 max-w-3xl space-y-6 overflow-x-clip",
    rowClassName: "h-16 rounded bg-inset",
    leading: (
      <>
        <div className="h-10 w-40 rounded bg-inset" />
        <div className="h-32 rounded bg-inset" />
      </>
    ),
    title: (locale) => getUserPlatformCopy(locale).edit,
  });
}
