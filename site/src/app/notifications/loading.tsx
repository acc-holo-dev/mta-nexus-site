import { NotificationInboxRouteLoading } from "../../features/notifications/notification-inbox-route-loading-server";

export default async function Loading() {
  return NotificationInboxRouteLoading({
    headingId: "notification-inbox-loading-heading",
    className: "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip",
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
