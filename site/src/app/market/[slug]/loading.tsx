import { RouteHonestLoading } from "../../../features/shell/route-honest-loading-server";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";

export default async function Loading() {
  const dictionary = getDictionary(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="market-resource-loading-heading"
      title={dictionary.market.title}
      loadingLabel={dictionary.market.loading}
      className="min-w-0 space-y-6 overflow-x-clip"
      rows={0}
      leading={
        <>
          <div className="h-48 rounded bg-inset" />
          <div className="h-8 w-64 max-w-full rounded bg-inset" />
          <div className="h-24 rounded bg-inset" />
          <div className="h-32 rounded bg-inset" />
        </>
      }
    />
  );
}
