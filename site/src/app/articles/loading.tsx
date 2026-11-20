import { ArticlesRouteLoading } from "../../features/community/articles-route-loading-server";

export default async function Loading() {
  return ArticlesRouteLoading({
    headerClassName: "space-y-2 border-b border-base pb-6",
    titleClassName: "text-2xl font-extrabold text-primary sm:text-3xl",
  });
}
