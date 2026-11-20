import { AuthorResourcesRouteLoading } from "../../../../features/resources/author-resources-route-loading-server";
import { pageShellMax5xlTight } from "../../../../features/shell/page-shell";

export default async function Loading() {
  return AuthorResourcesRouteLoading({
    headingId: "author-resource-loading-heading",
    titleKey: "edit",
    className: pageShellMax5xlTight,
    headerClassName: "border-b border-base pb-6",
    statusClassName: "mt-2 text-sm text-muted",
    leading: <div className="h-32 rounded bg-inset" />,
    rows: 3,
  });
}
