import { OrganizationWorkspaceRouteLoading } from "../../../../features/organizations/organization-workspace-route-loading-server";

export default async function Loading() {
  return OrganizationWorkspaceRouteLoading({
    headingId: "org-new-loading-heading",
    className: "mx-auto min-w-0 max-w-3xl space-y-5 overflow-x-clip py-8",
    titleKey: "create",
  });
}
