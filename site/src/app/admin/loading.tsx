import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n/server";
import { RouteHonestLoading } from "../../features/shell/route-honest-loading-server";

export default async function Loading() {
  const copy = getDictionary(await getRequestLocale()).admin;
  return (
    <RouteHonestLoading
      headingId="admin-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      className="min-w-0 space-y-6 overflow-x-clip"
      rows={4}
      leading={<div className="h-28 rounded bg-inset" />}
    />
  );
}
