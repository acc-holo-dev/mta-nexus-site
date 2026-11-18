import { HonestLoadingShell } from "../../../features/shell/honest-loading";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";

// Honest loading shell for /support/[id].
export default async function Loading() {
  const copy = getDictionary(await getRequestLocale()).support;
  return (
    <HonestLoadingShell
      className="min-w-0 space-y-6 overflow-x-clip"
      headingId="support-case-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-24 rounded bg-inset" />
        <div className="h-40 rounded bg-inset" />
        <div className="h-28 rounded bg-inset" />
      </div>
    </HonestLoadingShell>
  );
}
