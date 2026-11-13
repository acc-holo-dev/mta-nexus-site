import { getRequestLocale } from "../../../../lib/i18n-server";
import { contextTrustCopy } from "../../../../lib/public-context-trust-copy";

// Honest loading shell for /organizations/[slug]/trust and /servers/[slug]/trust.
export default async function Loading() {
  const copy = contextTrustCopy(await getRequestLocale());
  return (
    <section
      className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip"
      aria-busy="true"
      aria-labelledby="context-trust-loading-heading"
    >
      <header className="nexus-panel min-w-0 space-y-3 overflow-x-clip p-6">
        <h1 id="context-trust-loading-heading" className="text-xl font-bold text-primary">
          {copy.title}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {copy.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-24 max-w-full rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
