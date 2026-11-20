import { SellerSalesRouteLoading } from "../../../../../features/commerce/seller-sales-route-loading-server";
import { pageShellMax5xl } from "../../../../../features/shell/page-shell";

export default async function Loading() {
  return SellerSalesRouteLoading({
    headingId: "sales-report-detail-loading-heading",
    className: pageShellMax5xl,
    rows: 4,
    leading: <div className="h-10 w-64 rounded bg-inset" />,
    titleKey: "detail",
    loadingKey: "detailLoading",
  });
}
