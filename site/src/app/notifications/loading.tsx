import { notificationInboxCopy } from "../../features/notifications/notification-inbox-copy";
import { LocaleCopyRouteLoading } from "../../features/shell/route-honest-loading-server";

export default async function NotificationInboxLoading() {
  return LocaleCopyRouteLoading({
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
    load: (locale) => {
      const copy = notificationInboxCopy(locale);
      return {
        title: copy.title,
        loading: copy.loading,
      };
    },
  });
}
