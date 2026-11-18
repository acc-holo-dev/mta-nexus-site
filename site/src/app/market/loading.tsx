import { HonestLoadingShell } from "../../features/shell/honest-loading";
import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n/server";

// Honest loading shell for /market.
export default async function Loading() {
  const dictionary = getDictionary(await getRequestLocale());
  return (
    <HonestLoadingShell
      className="min-w-0 space-y-6 overflow-x-clip"
      headingId="market-loading-heading"
      title={dictionary.market.title}
      loadingLabel={dictionary.market.loading}
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-11 rounded bg-inset" />
        <div className="h-10 w-80 max-w-full rounded bg-inset" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((key) => (
            <div key={key} className="h-40 rounded bg-inset" />
          ))}
        </div>
      </div>
    </HonestLoadingShell>
  );
}
