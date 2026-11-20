import { AuthorResourcesRouteLoading } from "../../../../../features/resources/author-resources-route-loading-server";

export default async function Loading() {
  return AuthorResourcesRouteLoading({
    headingId: "org-content-loading-heading",
    leading: <div className="h-10 w-64 rounded bg-inset" />,
  });
}
