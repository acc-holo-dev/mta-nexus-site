import { HonestLoadingShell } from "../../features/shell/honest-loading";
import { getDictionary } from "../../lib/platform/i18n";
import { getRequestLocale } from "../../lib/platform/i18n-server";

// Honest loading shell for /privacy.
export default async function Loading() {
  const dictionary = getDictionary(await getRequestLocale());
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-3xl space-y-6 overflow-x-clip py-8"
      headingId="privacy-loading-heading"
      title={dictionary.legal.privacy.title}
      loadingLabel={dictionary.errors.loading}
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-4 w-40 rounded bg-inset" />
        <div className="h-24 rounded bg-inset" />
        <div className="h-24 rounded bg-inset" />
        <div className="h-24 rounded bg-inset" />
      </div>
    </HonestLoadingShell>
  );
}
