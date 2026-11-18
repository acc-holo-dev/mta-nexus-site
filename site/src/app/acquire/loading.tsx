import { HonestLoadingShell } from "../../features/shell/honest-loading";
import { getDictionary } from "../../lib/platform/i18n";
import { getRequestLocale } from "../../lib/platform/i18n-server";

// Honest loading shell for /acquire (free resource claim).
export default async function Loading() {
  const dictionary = getDictionary(await getRequestLocale());
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-3xl space-y-6 overflow-x-clip py-8"
      headingId="acquire-loading-heading"
      title={dictionary.checkout.title}
      loadingLabel={dictionary.checkout.loadingProduct}
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-28 rounded bg-inset" />
        <div className="h-12 w-48 rounded bg-inset" />
        <div className="h-20 rounded bg-inset" />
      </div>
    </HonestLoadingShell>
  );
}
