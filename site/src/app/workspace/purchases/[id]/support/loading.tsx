import { OrderCaseRouteLoading } from "../../../../../features/commerce/order-case-route-loading-server";
import { pageShellMax5xl } from "../../../../../features/shell/page-shell";

export default async function Loading() {
  return OrderCaseRouteLoading({
    headingId: "purchase-support-loading-heading",
    className: pageShellMax5xl,
    rows: 4,
    leading: <div className="h-10 w-64 rounded bg-inset" />,
    titleKey: "create",
  });
}
