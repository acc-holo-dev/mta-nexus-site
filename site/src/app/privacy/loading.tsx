import { RouteHonestLoading } from "../../features/shell/route-honest-loading-server";
import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n/server";

export default async function Loading() {
  const dictionary = getDictionary(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="privacy-loading-heading"
      title={dictionary.legal.privacy.title}
      loadingLabel={dictionary.errors.loading}
      className="mx-auto min-w-0 max-w-3xl space-y-6 overflow-x-clip py-8"
      rows={0}
      leading={
        <>
          <div className="h-4 w-40 rounded bg-inset" />
          <div className="h-24 rounded bg-inset" />
          <div className="h-24 rounded bg-inset" />
          <div className="h-24 rounded bg-inset" />
        </>
      }
    />
  );
}
