import { OrganizationGovernanceRouteLoading } from "../../../../../features/organizations/organization-governance-route-loading-server";

export default async function Loading() {
  return OrganizationGovernanceRouteLoading({
    headingId: "organization-activity-loading-heading",
    className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8",
    rowClassName: "h-24 rounded bg-inset",
    leading: <div className="h-10 w-2/3 max-w-md rounded bg-inset" />,
    titleKey: "history",
    loadingKey: "historyDescription",
  });
}
