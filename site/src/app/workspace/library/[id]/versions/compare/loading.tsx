import { RouteHonestLoading } from "../../../../../../features/shell/route-honest-loading-server";
import { getDictionary } from "../../../../../../lib/i18n";
import { getRequestLocale } from "../../../../../../lib/i18n/server";

export default async function Loading() {
  const dictionary = getDictionary(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="library-versions-compare-loading-heading"
      title={dictionary.workspace.libraryTitle}
      loadingLabel={dictionary.workspace.loading}
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      rows={4}
      leading={<div className="h-10 w-64 rounded bg-inset" />}
    />
  );
}
