import { HonestLoadingShell } from "../../features/shell/honest-loading";
import { getDictionary } from "../../lib/platform/i18n";
import { getRequestLocale } from "../../lib/platform/i18n-server";

// Honest loading shell for /developers.
export default async function Loading() {
  const copy = getDictionary(await getRequestLocale()).developers;
  return (
    <HonestLoadingShell
      className="min-w-0 space-y-6 overflow-x-clip"
      headingId="developers-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      headerClassName="space-y-2 border-b border-base pb-6"
      titleClassName="text-2xl font-extrabold text-primary"
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-11 max-w-full rounded bg-inset" />
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="h-24 max-w-full rounded bg-inset" />
        ))}
      </div>
    </HonestLoadingShell>
  );
}
