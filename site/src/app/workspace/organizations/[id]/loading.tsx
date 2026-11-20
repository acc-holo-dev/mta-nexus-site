import { OrganizationWorkspaceRouteLoading } from "../../../../features/organizations/organization-workspace-route-loading-server";
import { pageShellMax5xlCompact } from "../../../../features/shell/page-shell";

export default async function Loading() {
  return OrganizationWorkspaceRouteLoading({
    headingId: "organization-loading-heading",
    className: pageShellMax5xlCompact,
    rowClassName: "h-28 rounded bg-inset",
    titleKey: "profile",
  });
}
