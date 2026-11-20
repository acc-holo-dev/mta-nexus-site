import { CommunityCatalogRouteLoading } from "../../../features/community/community-catalog-route-loading-server";
import { pageShellMax3xl } from "../../../features/shell/page-shell";

export default async function Loading() {
  return CommunityCatalogRouteLoading({
    headingId: "community-new-loading-heading",
    titlePath: "community.startTitle",
    className: pageShellMax3xl,
    rows: 0,
    leading: (
      <>
        <div className="h-11 rounded bg-inset" />
        <div className="h-40 rounded bg-inset" />
        <div className="h-28 rounded bg-inset" />
      </>
    ),
  });
}
