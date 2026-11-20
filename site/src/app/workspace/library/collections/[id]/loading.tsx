import { libraryCollectionsCopy } from "../../../../../features/library/library-collections-i18n";
import { LocaleCopyRouteLoading } from "../../../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return LocaleCopyRouteLoading({
    headingId: "library-collection-detail-loading-heading",
    className: "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip",
    leading: <div className="h-28 rounded bg-inset" />,
    load: (locale) => {
      const copy = libraryCollectionsCopy(locale);
      return {
        title: copy.title,
        loading: copy.loading,
      };
    },
  });
}
