import { OrganizationTeamRouteLoading } from "../../../../../features/organizations/organization-team-route-loading-server";
import { pageShellMax4xlDense } from "../../../../../features/shell/page-shell";

export default async function Loading() {
  return OrganizationTeamRouteLoading({
    headingId: "organization-team-loading-heading",
    className: pageShellMax4xlDense,
    titleClassName: "text-xl font-semibold text-primary",
    rowClassName: "h-16 rounded bg-inset",
    leading: <div className="h-6 w-2/3 rounded bg-inset" />,
    titleKey: "title",
  });
}
