import { discoveryCopy } from "../../lib/discovery-copy";
import { getRequestLocale } from "../../lib/i18n-server";

// Honest loading shell for /organizations.
export default async function Loading() {
  const copy = discoveryCopy(await getRequestLocale());
  return (
    <section className="space-y-6" aria-busy="true" aria-labelledby="organizations-loading-heading">
      <header className="space-y-2 border-b border-base pb-6">
        <h1 id="organizations-loading-heading" className="text-2xl font-extrabold text-primary">
          {copy.organizationsTitle}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {copy.organizationsLoading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-11 rounded bg-inset" />
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="h-24 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
