import { FinancialRouteLoading } from "../../../features/commerce/financial-route-loading-server";

export default async function Loading() {
  return FinancialRouteLoading({
    headingId: "finance-loading-heading",
    className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8",
    rows: 4,
    leading: (
      <>
        <div className="h-10 w-72 rounded bg-inset" />
        <div className="h-24 rounded bg-inset" />
      </>
    ),
    titleKey: "title",
  });
}
