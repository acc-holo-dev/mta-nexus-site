import { HonestLoadingShell } from "../../features/shell/honest-loading";
import { getDictionary } from "../../lib/platform/i18n";
import { getRequestLocale } from "../../lib/platform/i18n-server";

// Honest loading shell for /security.
export default async function Loading() {
  const copy = getDictionary(await getRequestLocale()).securityCenter;
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-3xl space-y-6 overflow-x-clip py-8"
      headingId="security-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-28 rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </HonestLoadingShell>
  );
}
