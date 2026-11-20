import { OrganizationWorkspaceRouteLoading } from "../../../features/organizations/organization-workspace-route-loading-server";

export default async function Loading() {
  return OrganizationWorkspaceRouteLoading({
    headingId: "organizations-loading-heading",
    titleKey: "title",
    loadingKey: "listLoading",
    leading: <div className="h-28 rounded bg-inset" />,
  });
}
