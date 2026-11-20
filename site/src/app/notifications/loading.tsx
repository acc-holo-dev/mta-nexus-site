import { NotificationInboxRouteLoading } from "../../features/notifications/notification-inbox-route-loading-server";
import { pageShellMax4xlTight } from "../../features/shell/page-shell";

export default async function Loading() {
  return NotificationInboxRouteLoading({
    headingId: "notification-inbox-loading-heading",
    className: pageShellMax4xlTight,
    headerClassName: "space-y-3 border-b border-base pb-6",
    titleClassName: "text-2xl font-extrabold text-primary",
    leading: (
      <>
        <div className="h-10 w-full max-w-md rounded bg-inset" />
        <div className="h-28 rounded bg-inset" />
      </>
    ),
    titleKey: "title",
  });
}
