import { HonestLoadingShell } from "../../../features/shell/honest-loading";
import { getDictionary } from "../../../lib/platform/i18n";
import { getRequestLocale } from "../../../lib/platform/i18n-server";

// Honest loading shell for /market/[slug].
export default async function Loading() {
  const dictionary = getDictionary(await getRequestLocale());
  return (
    <HonestLoadingShell
      className="min-w-0 space-y-6 overflow-x-clip"
      headingId="market-resource-loading-heading"
      title={dictionary.market.title}
      loadingLabel={dictionary.market.loading}
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-48 rounded bg-inset" />
        <div className="h-8 w-64 max-w-full rounded bg-inset" />
        <div className="h-24 rounded bg-inset" />
        <div className="h-32 rounded bg-inset" />
      </div>
    </HonestLoadingShell>
  );
}
