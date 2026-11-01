import { getRequestLocale } from "../../../../lib/i18n-server";
import { trustCopy } from "../../../../lib/public-user-trust-copy";

// Honest loading shell for /users/[username]/trust.
export default async function Loading() {
  const copy = trustCopy(await getRequestLocale());
  return (
    <section
      className="mx-auto max-w-4xl space-y-6"
      aria-busy="true"
      aria-labelledby="user-trust-loading-heading"
    >
      <div className="h-5 w-32 animate-pulse rounded bg-inset" aria-hidden="true" />
      <header className="nexus-panel space-y-3 p-6">
        <h1 id="user-trust-loading-heading" className="text-xl font-bold text-primary">
          {copy.title}
        </h1>
        <p role="status" className="text-sm text-muted">
          {copy.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-24 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
