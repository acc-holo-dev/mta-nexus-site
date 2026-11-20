import { FinancialRouteLoading } from "../../../../../features/commerce/financial-route-loading-server";

export default async function Loading() {
  return FinancialRouteLoading({
    headingId: "admin-reconciliation-detail-loading-heading",
    className: "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8",
    rows: 4,
    leading: <div className="h-10 w-72 max-w-full rounded bg-inset" />,
    titleKey: "review",
    loadingKey: "reviewLoading",
  });
}
