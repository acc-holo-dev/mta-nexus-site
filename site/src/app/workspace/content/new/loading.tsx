import { authorPublicationDeskCopy } from "../../../../features/community/author-publication-desk-copy";
import { LocaleCopyRouteLoading } from "../../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return LocaleCopyRouteLoading({
    headingId: "content-new-loading-heading",
    className: "mx-auto min-w-0 max-w-3xl space-y-6 overflow-x-clip",
    rows: 0,
    leading: (
      <>
        <div className="h-11 rounded bg-inset" />
        <div className="h-64 rounded bg-inset" />
      </>
    ),
    load: (locale) => {
      const copy = authorPublicationDeskCopy(locale);
      return {
        title: copy.title,
        loading: copy.loading,
      };
    },
  });
}
