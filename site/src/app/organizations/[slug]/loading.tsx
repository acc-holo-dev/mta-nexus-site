import { RouteHonestLoading } from "../../../features/shell/route-honest-loading-server";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";

export default async function Loading() {
  const copy = getDictionary(await getRequestLocale()).organizations;
  return (
    <RouteHonestLoading
      headingId="organization-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      className="min-w-0 space-y-6 overflow-x-clip"
      rows={0}
      leading={
        <>
          <div className="h-28 max-w-full rounded bg-inset" />
          <div className="h-40 max-w-full rounded bg-inset" />
          <div className="h-32 max-w-full rounded bg-inset" />
        </>
      }
    />
  );
}
