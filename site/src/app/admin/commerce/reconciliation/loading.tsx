import { FinancialRouteLoading } from "../../../../features/commerce/financial-route-loading-server";
import { pageShellMax5xl } from "../../../../features/shell/page-shell";

export default async function Loading() {
  return FinancialRouteLoading({
    headingId: "admin-reconciliation-loading-heading",
    className: pageShellMax5xl,
    rows: 4,
    leading: <div className="h-10 w-72 max-w-full rounded bg-inset" />,
    titleKey: "review",
    loadingKey: "reviewLoading",
  });
}
