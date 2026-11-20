import { libraryCollectionComparisonCopy } from "../../../../../../features/library/library-collection-comparison-i18n";
import { RouteHonestLoading } from "../../../../../../features/shell/route-honest-loading-server";
import { getRequestLocale } from "../../../../../../lib/i18n/server";

export default async function Loading() {
  const copy = libraryCollectionComparisonCopy(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="collection-compare-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      leading={
        <>
          <div className="h-10 w-72 rounded bg-inset" />
          <div className="h-24 rounded bg-inset" />
        </>
      }
    />
  );
}
