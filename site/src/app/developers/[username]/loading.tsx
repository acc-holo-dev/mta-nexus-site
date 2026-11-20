import { DevelopersRouteLoading } from "../../../features/discovery/developers-route-loading-server";

export default async function Loading() {
  return DevelopersRouteLoading({
    headingId: "developer-loading-heading",
    titlePath: "developers.creatorProfile",
    rows: 0,
    leading: (
      <>
        <div className="h-28 max-w-full rounded bg-inset" />
        <div className="h-40 max-w-full rounded bg-inset" />
      </>
    ),
  });
}
