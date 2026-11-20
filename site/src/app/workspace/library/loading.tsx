import { getLibraryCopy } from "../../../features/library/library-view";
import { RouteHonestLoading } from "../../../features/shell/route-honest-loading-server";
import { getRequestLocale } from "../../../lib/i18n/server";

export default async function Loading() {
  const copy = getLibraryCopy(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="library-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      rows={4}
      rowClassName="h-28 rounded bg-inset"
      leading={
        <>
          <div className="h-10 w-72 rounded bg-inset" />
          <div className="h-24 rounded bg-inset" />
        </>
      }
    />
  );
}
