import { libraryCollectionComparisonCopy } from "../../../../../../features/library/library-collection-comparison-i18n";
import { LocaleCopyRouteLoading } from "../../../../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return LocaleCopyRouteLoading({
    headingId: "collection-compare-loading-heading",
    className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8",
    leading: (
      <>
        <div className="h-10 w-72 rounded bg-inset" />
        <div className="h-24 rounded bg-inset" />
      </>
    ),
    load: (locale) => {
      const copy = libraryCollectionComparisonCopy(locale);
      return {
        title: copy.title,
        loading: copy.loading,
      };
    },
  });
}
