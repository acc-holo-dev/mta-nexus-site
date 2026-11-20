import { StorageMaintenanceRouteLoading } from "../../../../../features/moderation/storage-maintenance-route-loading-server";
import { pageShellMax4xl } from "../../../../../features/shell/page-shell";

export default async function Loading() {
  return StorageMaintenanceRouteLoading({
    headingId: "admin-storage-object-loading-heading",
    className: pageShellMax4xl,
    rows: 4,
    leading: <div className="h-10 w-72 rounded bg-inset" />,
    titleKey: "detail",
  });
}
