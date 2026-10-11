import { getRequestLocale } from "../../lib/i18n-server";
import { notificationInboxCopy } from "../../lib/notification-inbox-copy";
export default async function NotificationInboxLoading() {
  const copy = notificationInboxCopy(await getRequestLocale());
  return (
    <p role="status" className="nexus-panel mx-auto max-w-4xl p-6 text-sm text-muted">
      {copy.loading}
    </p>
  );
}
