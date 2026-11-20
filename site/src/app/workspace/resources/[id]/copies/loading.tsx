import { AuthorResourcesRouteLoading } from "../../../../../features/resources/author-resources-route-loading-server";

export default async function Loading() {
  return AuthorResourcesRouteLoading({
    headingId: "resource-copies-loading-heading",
    leading: <div className="h-10 w-64 rounded bg-inset" />,
  });
}
