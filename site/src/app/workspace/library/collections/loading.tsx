import { LibraryCollectionsRouteLoadingPort } from "../../../../features/library/library-collections-route-loading-server";

export default async function Loading() {
  return LibraryCollectionsRouteLoadingPort();
}
