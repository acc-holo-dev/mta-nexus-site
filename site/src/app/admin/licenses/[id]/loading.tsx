import { CommerceHistoryRouteLoading } from "../../../../features/commerce/commerce-history-route-loading-server";
import { getLicenseControlCopy } from "../../../../features/commerce/license-control-i18n";

export default async function Loading() {
  return CommerceHistoryRouteLoading({
    headingId: "admin-license-detail-loading-heading",
    leading: <div className="h-28 rounded bg-inset" />,
    title: (locale) => getLicenseControlCopy(locale).title,
  });
}
