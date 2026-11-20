import { CommerceHistoryRouteLoading } from "../../../../features/commerce/commerce-history-route-loading-server";
import { getLicenseMaintenanceCopy } from "../../../../features/commerce/license-maintenance-i18n";

export default async function Loading() {
  return CommerceHistoryRouteLoading({
    headingId: "admin-license-maintenance-loading-heading",
    leading: <div className="h-10 w-72 rounded bg-inset" />,
    title: (locale) => getLicenseMaintenanceCopy(locale).maintenance,
  });
}
