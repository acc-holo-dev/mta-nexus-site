import { RouteHonestLoading } from "../../features/shell/route-honest-loading-server";
import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n/server";

export default async function Loading() {
  const dictionary = getDictionary(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="market-loading-heading"
      title={dictionary.market.title}
      loadingLabel={dictionary.market.loading}
      className="min-w-0 space-y-6 overflow-x-clip"
      rows={6}
      rowClassName="h-40 rounded bg-inset"
      leading={
        <>
          <div className="h-11 rounded bg-inset" />
          <div className="h-10 w-80 max-w-full rounded bg-inset" />
        </>
      }
    />
  );
}
