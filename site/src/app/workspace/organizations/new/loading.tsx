import { OrganizationWorkspaceRouteLoading } from "../../../../features/organizations/organization-workspace-route-loading-server";
import { pageShellMax3xlCompact } from "../../../../features/shell/page-shell";

export default async function Loading() {
  return OrganizationWorkspaceRouteLoading({
    headingId: "org-new-loading-heading",
    className: pageShellMax3xlCompact,
    titleKey: "create",
  });
}
