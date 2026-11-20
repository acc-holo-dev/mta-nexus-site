import { libraryCollectionHistoryCopy } from "../../../../../features/library/library-collection-history-i18n";
import { getRequestLocale } from "../../../../../lib/i18n/server";
import { RouteHonestLoading } from "../../../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  const copy = libraryCollectionHistoryCopy(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="collection-history-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip"
      leading={<div className="h-28 rounded bg-inset" />}
    />
  );
}
