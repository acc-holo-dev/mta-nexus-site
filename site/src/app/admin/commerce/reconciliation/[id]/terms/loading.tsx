import { OrderTermsRouteLoading } from "../../../../../../features/commerce/order-terms-route-loading-server";
import { pageShellMax5xl } from "../../../../../../features/shell/page-shell";

export default async function Loading() {
  return OrderTermsRouteLoading({
    headingId: "admin-reconciliation-terms-loading-heading",
    className: pageShellMax5xl,
    rows: 4,
    leading: <div className="h-10 w-72 max-w-full rounded bg-inset" />,
    titleKey: "title",
    loadingKey: "termsLoading",
  });
}
