import { approvalCopy } from "../../../../../lib/public-verification-history-copy";
import { getRequestLocale } from "../../../../../lib/i18n-server";

// Honest loading shell for /users/[username]/trust/history.
export default async function Loading() {
  const copy = approvalCopy(await getRequestLocale());
  return (
    <section
      className="mx-auto max-w-4xl space-y-6"
      aria-busy="true"
      aria-labelledby="user-trust-history-loading-heading"
    >
      <header className="nexus-panel space-y-3 p-6">
        <h1 id="user-trust-history-loading-heading" className="text-xl font-bold text-primary">
          {copy.title}
        </h1>
        <p role="status" className="text-sm text-muted">
          {copy.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
