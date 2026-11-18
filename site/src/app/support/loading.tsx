import { HonestLoadingShell } from "../../features/shell/honest-loading";
import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n/server";

// Honest loading shell for /support.
export default async function Loading() {
  const dictionary = getDictionary(await getRequestLocale());
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8"
      headingId="support-loading-heading"
      title={dictionary.support.title}
      loadingLabel={dictionary.support.loading}
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-24 rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </HonestLoadingShell>
  );
}
