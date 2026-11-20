import { RouteHonestLoading } from "../../features/shell/route-honest-loading-server";
import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n/server";

export default async function Loading() {
  const copy = getDictionary(await getRequestLocale()).discover;
  return (
    <RouteHonestLoading
      headingId="discover-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      className="min-w-0 space-y-6 overflow-x-clip"
      rows={4}
      rowClassName="h-24 rounded bg-inset"
      leading={
        <>
          <div className="h-11 rounded bg-inset" />
          <div className="h-10 w-96 max-w-full rounded bg-inset" />
        </>
      }
    />
  );
}
