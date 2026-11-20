import { RouteHonestLoading } from "../../../features/shell/route-honest-loading-server";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";

export default async function Loading() {
  const copy = getDictionary(await getRequestLocale()).serverDetail;
  return (
    <RouteHonestLoading
      headingId="server-detail-loading-heading"
      title={copy.breadcrumb}
      loadingLabel={copy.loading}
      className="min-w-0 space-y-6 overflow-x-clip"
      rows={0}
      leading={
        <>
          <div className="h-32 rounded bg-inset" />
          <div className="h-24 rounded bg-inset" />
          <div className="h-40 rounded bg-inset" />
        </>
      }
    />
  );
}
