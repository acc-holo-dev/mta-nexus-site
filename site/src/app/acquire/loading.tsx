import { RouteHonestLoading } from "../../features/shell/route-honest-loading-server";
import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n/server";

export default async function Loading() {
  const dictionary = getDictionary(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="acquire-loading-heading"
      title={dictionary.checkout.title}
      loadingLabel={dictionary.checkout.loadingProduct}
      className="mx-auto min-w-0 max-w-3xl space-y-6 overflow-x-clip py-8"
      rows={0}
      leading={
        <>
          <div className="h-28 rounded bg-inset" />
          <div className="h-12 w-48 rounded bg-inset" />
          <div className="h-20 rounded bg-inset" />
        </>
      }
    />
  );
}
