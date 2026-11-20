import { OrderTermsRouteLoading } from "../../../../../../features/commerce/order-terms-route-loading-server";

export default async function Loading() {
  return OrderTermsRouteLoading({
    headingId: "admin-reconciliation-terms-loading-heading",
    className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8",
    rows: 4,
    leading: <div className="h-10 w-72 max-w-full rounded bg-inset" />,
    titleKey: "title",
    loadingKey: "termsLoading",
  });
}
