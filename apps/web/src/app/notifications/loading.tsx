import { getRequestLocale } from "../../lib/i18n-server";
import { notificationInboxCopy } from "../../lib/notification-inbox-copy";

// Honest loading shell for /notifications.
export default async function NotificationInboxLoading() {
  const copy = notificationInboxCopy(await getRequestLocale());
  return (
    <section
      className="mx-auto max-w-4xl space-y-6"
      aria-busy="true"
      aria-labelledby="notification-inbox-loading-heading"
    >
      <header className="space-y-3 border-b border-base pb-6">
        <h1
          id="notification-inbox-loading-heading"
          className="text-2xl font-extrabold text-primary"
        >
          {copy.title}
        </h1>
        <p role="status" className="text-sm text-muted">
          {copy.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-10 w-full max-w-md rounded bg-inset" />
        <div className="h-28 rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
