import { StorageMaintenanceRouteLoading } from "../../../features/moderation/storage-maintenance-route-loading-server";
import { pageShellMax5xl } from "../../../features/shell/page-shell";

export default async function Loading() {
  return StorageMaintenanceRouteLoading({
    headingId: "admin-storage-loading-heading",
    className: pageShellMax5xl,
    leading: <div className="h-28 rounded bg-inset" />,
    titleKey: "title",
  });
}
