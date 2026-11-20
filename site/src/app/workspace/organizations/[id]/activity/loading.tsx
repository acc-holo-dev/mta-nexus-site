import { OrganizationGovernanceRouteLoading } from "../../../../../features/organizations/organization-governance-route-loading-server";
import { pageShellMax5xl } from "../../../../../features/shell/page-shell";

export default async function Loading() {
  return OrganizationGovernanceRouteLoading({
    headingId: "organization-activity-loading-heading",
    className: pageShellMax5xl,
    rowClassName: "h-24 rounded bg-inset",
    leading: <div className="h-10 w-2/3 max-w-md rounded bg-inset" />,
    titleKey: "history",
    loadingKey: "historyDescription",
  });
}
