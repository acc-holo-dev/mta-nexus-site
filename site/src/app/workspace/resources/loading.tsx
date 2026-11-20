import { AuthorResourcesRouteLoading } from "../../../features/resources/author-resources-route-loading-server";

export default async function Loading() {
  return AuthorResourcesRouteLoading({
    headingId: "author-resources-loading-heading",
  });
}
