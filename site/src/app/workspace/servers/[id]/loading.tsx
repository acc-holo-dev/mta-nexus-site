import { ManagedServerRouteLoading } from "../../../../features/servers/managed-server-route-loading-server";
import { pageShellMax4xl } from "../../../../features/shell/page-shell";
import { getDictionary } from "../../../../lib/i18n";

export default async function Loading() {
  return ManagedServerRouteLoading({
    headingId: "server-management-loading-heading",
    className: pageShellMax4xl,
    titleClassName: "text-2xl font-black text-primary",
    rows: 3,
    rowClassName: "h-32 rounded bg-inset",
    leading: <div className="h-24 rounded bg-inset" />,
    title: (locale) => getDictionary(locale).serverManagement.listingDetails,
    loading: (locale) => getDictionary(locale).serverDetail.loading,
  });
}
