import { ResourceCommerceRouteLoading } from "../../../features/resources/resource-commerce-route-loading-server";
import { pageShellMax4xl } from "../../../features/shell/page-shell";

export default async function Loading() {
  return ResourceCommerceRouteLoading({
    headingId: "cart-loading-heading",
    className: pageShellMax4xl,
    leading: <div className="h-24 rounded bg-inset" />,
    titleKey: "cart",
  });
}
