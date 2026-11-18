import { HonestLoadingShell } from "../../../features/shell/honest-loading";
import { getDictionary } from "../../../lib/platform/i18n";
import { getRequestLocale } from "../../../lib/platform/i18n-server";

// Honest loading shell for /organizations/[slug].
export default async function Loading() {
  const copy = getDictionary(await getRequestLocale()).organizations;
  return (
    <HonestLoadingShell
      className="min-w-0 space-y-6 overflow-x-clip"
      headingId="organization-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-28 max-w-full rounded bg-inset" />
        <div className="h-40 max-w-full rounded bg-inset" />
        <div className="h-32 max-w-full rounded bg-inset" />
      </div>
    </HonestLoadingShell>
  );
}
