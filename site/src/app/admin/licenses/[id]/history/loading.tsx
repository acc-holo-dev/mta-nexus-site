import { CommerceHistoryRouteLoading } from "../../../../../features/commerce/commerce-history-route-loading-server";
import { getLicenseControlCopy } from "../../../../../features/commerce/license-control-i18n";

export default async function Loading() {
  return CommerceHistoryRouteLoading({
    headingId: "admin-license-history-loading-heading",
    className: "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8",
    leading: <div className="h-10 w-64 rounded bg-inset" />,
    title: (locale) => getLicenseControlCopy(locale).fullHistory,
  });
}
