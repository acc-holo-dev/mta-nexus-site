import { LibraryMembershipHistoryRouteLoading } from "../../../../../features/library/library-membership-history-route-loading-server";
import { pageShellMax5xl } from "../../../../../features/shell/page-shell";

export default async function Loading() {
  return LibraryMembershipHistoryRouteLoading({
    headingId: "membership-history-loading-heading",
    className: pageShellMax5xl,
    rows: 4,
    leading: <div className="h-10 w-72 rounded bg-inset" />,
    titleKey: "title",
  });
}
