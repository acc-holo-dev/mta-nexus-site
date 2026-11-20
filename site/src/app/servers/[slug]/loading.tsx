import { ServersDirectoryRouteLoading } from "../../../features/servers/servers-directory-route-loading-server";
import { pageShellStack6 } from "../../../features/shell/page-shell";

export default async function Loading() {
  return ServersDirectoryRouteLoading({
    headingId: "server-detail-loading-heading",
    titlePath: "serverDetail.breadcrumb",
    loadingPath: "serverDetail.loading",
    className: pageShellStack6,
    rows: 0,
    leading: (
      <>
        <div className="h-32 rounded bg-inset" />
        <div className="h-24 rounded bg-inset" />
        <div className="h-40 rounded bg-inset" />
      </>
    ),
  });
}
