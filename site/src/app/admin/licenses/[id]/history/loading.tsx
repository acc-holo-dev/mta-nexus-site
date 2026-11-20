import { CommerceHistoryRouteLoading } from "../../../../../features/commerce/commerce-history-route-loading-server";
import { getLicenseControlCopy } from "../../../../../features/commerce/license-control-i18n";
import { pageShellMax4xl } from "../../../../../features/shell/page-shell";

export default async function Loading() {
  return CommerceHistoryRouteLoading({
    headingId: "admin-license-history-loading-heading",
    className: pageShellMax4xl,
    leading: <div className="h-10 w-64 rounded bg-inset" />,
    title: (locale) => getLicenseControlCopy(locale).fullHistory,
  });
}
