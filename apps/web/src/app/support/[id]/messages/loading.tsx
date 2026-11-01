import { getRequestLocale } from "../../../../lib/i18n-server";
import { supportMessageCopy } from "../../../../lib/support-message-discovery-copy";

// Honest loading shell for /support/[id]/messages.
export default async function Loading() {
  const copy = supportMessageCopy(await getRequestLocale());
  return (
    <section
      className="mx-auto max-w-4xl space-y-6"
      aria-busy="true"
      aria-labelledby="support-messages-loading-heading"
    >
      <header className="space-y-3 border-b border-base pb-6">
        <h1 id="support-messages-loading-heading" className="text-2xl font-extrabold text-primary">
          {copy.title}
        </h1>
        <p role="status" className="text-sm text-muted">
          {copy.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-10 w-full max-w-md rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
