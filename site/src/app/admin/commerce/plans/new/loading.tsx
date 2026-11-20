import { CommercialRouteLoading } from "../../../../../features/commerce/commercial-route-loading-server";
import { pageShellMax4xl } from "../../../../../features/shell/page-shell";

export default async function Loading() {
  return CommercialRouteLoading({
    headingId: "admin-plan-new-loading-heading",
    className: pageShellMax4xl,
    titleKey: "newPlan",
  });
}
