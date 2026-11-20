import { OrganizationWorkspaceRouteLoading } from "../../../../features/organizations/organization-workspace-route-loading-server";

export default async function Loading() {
  return OrganizationWorkspaceRouteLoading({
    headingId: "organization-loading-heading",
    className: "mx-auto min-w-0 max-w-5xl space-y-5 overflow-x-clip py-8",
    rowClassName: "h-28 rounded bg-inset",
    titleKey: "profile",
  });
}
