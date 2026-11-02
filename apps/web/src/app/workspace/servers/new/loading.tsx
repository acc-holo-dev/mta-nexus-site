import { getDictionary } from "../../../../lib/i18n";
import { getRequestLocale } from "../../../../lib/i18n-server";

// Honest loading shell for /workspace/servers/new.
export default async function Loading() {
  const copy = getDictionary(await getRequestLocale()).serverRegistration;
  return (
    <section
      className="mx-auto max-w-3xl space-y-5"
      aria-busy="true"
      aria-labelledby="server-new-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="server-new-loading-heading" className="font-display text-primary">
          {copy.title}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {copy.organizationsLoading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-10 w-64 rounded bg-inset" />
        <div className="h-40 rounded bg-inset" />
        <div className="h-24 rounded bg-inset" />
      </div>
    </section>
  );
}
