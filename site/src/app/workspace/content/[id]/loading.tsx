import { authorPublicationDeskCopy } from "../../../../features/community/author-publication-desk-copy";
import { getUserPlatformCopy } from "../../../../features/community/user-platform-copy";
import { LocaleCopyRouteLoading } from "../../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return LocaleCopyRouteLoading({
    headingId: "edit-publication-loading-heading",
    className: "mx-auto min-w-0 max-w-3xl space-y-6 overflow-x-clip",
    rowClassName: "h-16 rounded bg-inset",
    leading: (
      <>
        <div className="h-10 w-40 rounded bg-inset" />
        <div className="h-32 rounded bg-inset" />
      </>
    ),
    load: (locale) => {
      const copy = getUserPlatformCopy(locale);
      const desk = authorPublicationDeskCopy(locale);
      return {
        title: copy.edit,
        loading: desk.loading,
      };
    },
  });
}
