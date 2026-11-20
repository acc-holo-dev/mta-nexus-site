import { AuthorResourcesRouteLoading } from "../../../../features/resources/author-resources-route-loading-server";

export default async function Loading() {
  return AuthorResourcesRouteLoading({
    headingId: "author-resource-loading-heading",
    titleKey: "edit",
    className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip",
    headerClassName: "border-b border-base pb-6",
    statusClassName: "mt-2 text-sm text-muted",
    leading: <div className="h-32 rounded bg-inset" />,
    rows: 3,
  });
}
