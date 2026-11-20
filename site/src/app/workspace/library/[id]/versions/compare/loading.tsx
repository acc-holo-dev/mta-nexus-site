import { WorkspaceHubRouteLoading } from "../../../../../../features/shell/workspace-hub-route-loading-server";

export default async function Loading() {
  return WorkspaceHubRouteLoading({
    headingId: "library-versions-compare-loading-heading",
    titlePath: "workspace.libraryTitle",
    rows: 4,
    leading: <div className="h-10 w-64 rounded bg-inset" />,
  });
}
