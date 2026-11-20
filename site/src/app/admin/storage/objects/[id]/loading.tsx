import { storageMaintenanceCopy } from "../../../../../features/moderation/storage-maintenance-i18n";
import { RouteHonestLoading } from "../../../../../features/shell/route-honest-loading-server";
import { getRequestLocale } from "../../../../../lib/i18n/server";

export default async function Loading() {
  const copy = storageMaintenanceCopy(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="admin-storage-object-loading-heading"
      title={copy.detail}
      loadingLabel={copy.loading}
      className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8"
      rows={4}
      leading={<div className="h-10 w-72 rounded bg-inset" />}
    />
  );
}
