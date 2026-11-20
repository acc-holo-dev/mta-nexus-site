import { getManagedServerCopy } from "../../../features/servers/managed-server-view";
import { getRequestLocale } from "../../../lib/i18n/server";
import { RouteHonestLoading } from "../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  const copy = getManagedServerCopy(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="managed-servers-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      className="mx-auto min-w-0 max-w-6xl space-y-6 overflow-x-clip py-8"
      leading={<div className="h-28 rounded bg-inset" />}
    />
  );
}
