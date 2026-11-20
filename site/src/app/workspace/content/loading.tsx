import { authorPublicationDeskCopy } from "../../../features/community/author-publication-desk-copy";
import { LocaleCopyRouteLoading } from "../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return LocaleCopyRouteLoading({
    headingId: "publication-desk-loading-heading",
    className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip",
    rowClassName: "h-24 rounded bg-inset",
    leading: <div className="h-32 rounded bg-inset" />,
    load: (locale) => {
      const copy = authorPublicationDeskCopy(locale);
      return {
        title: copy.title,
        loading: copy.loading,
      };
    },
  });
}
