import { CommunityCatalogRouteLoading } from "../../features/community/community-catalog-route-loading-server";

export default async function Loading() {
  return CommunityCatalogRouteLoading({
    headerClassName: "space-y-2 border-b border-base pb-5",
  });
}
