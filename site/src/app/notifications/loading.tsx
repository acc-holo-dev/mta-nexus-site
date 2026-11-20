import { notificationInboxCopy } from "../../features/notifications/notification-inbox-copy";
import { RouteHonestLoading } from "../../features/shell/route-honest-loading-server";
import { getRequestLocale } from "../../lib/i18n/server";

export default async function NotificationInboxLoading() {
  const copy = notificationInboxCopy(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="notification-inbox-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip"
      headerClassName="space-y-3 border-b border-base pb-6"
      titleClassName="text-2xl font-extrabold text-primary"
      leading={
        <>
          <div className="h-10 w-full max-w-md rounded bg-inset" />
          <div className="h-28 rounded bg-inset" />
        </>
      }
    />
  );
}
