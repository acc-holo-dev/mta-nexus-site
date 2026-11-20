import { DevelopersRouteLoading } from "../../features/discovery/developers-route-loading-server";

export default async function Loading() {
  return DevelopersRouteLoading({
    headingId: "developers-loading-heading",
    titlePath: "developers.title",
    headerClassName: "space-y-2 border-b border-base pb-6",
    titleClassName: "text-2xl font-extrabold text-primary",
  });
}
