import { RouteHonestLoading } from "../../../features/shell/route-honest-loading-server";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";

export default async function Loading() {
  const copy = getDictionary(await getRequestLocale()).community;
  return (
    <RouteHonestLoading
      headingId="community-new-loading-heading"
      title={copy.startTitle}
      loadingLabel={copy.loading}
      className="mx-auto min-w-0 max-w-3xl space-y-6 overflow-x-clip py-8"
      rows={0}
      leading={
        <>
          <div className="h-11 rounded bg-inset" />
          <div className="h-40 rounded bg-inset" />
          <div className="h-28 rounded bg-inset" />
        </>
      }
    />
  );
}
