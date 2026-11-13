import { getDictionary } from "../../../../lib/i18n";
import { getRequestLocale } from "../../../../lib/i18n-server";

// Honest loading shell for /workspace/servers/[id].
export default async function Loading() {
  const locale = await getRequestLocale();
  const copy = getDictionary(locale).serverManagement;
  const status = getDictionary(locale).serverDetail.loading;
  return (
    <section
      className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8"
      aria-busy="true"
      aria-labelledby="server-management-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="server-management-loading-heading" className="text-2xl font-black text-primary">
          {copy.listingDetails}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {status}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-24 rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-32 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
