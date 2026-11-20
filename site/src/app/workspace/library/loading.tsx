import { LibraryRouteLoadingPort } from "../../../features/library/library-route-loading-server";

export default async function Loading() {
  return LibraryRouteLoadingPort();
}
