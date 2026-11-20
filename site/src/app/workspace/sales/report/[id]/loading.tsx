import { SellerSalesRouteLoading } from "../../../../../features/commerce/seller-sales-route-loading-server";

export default async function Loading() {
  return SellerSalesRouteLoading({
    headingId: "sales-report-detail-loading-heading",
    className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8",
    rows: 4,
    leading: <div className="h-10 w-64 rounded bg-inset" />,
    titleKey: "detail",
    loadingKey: "detailLoading",
  });
}
