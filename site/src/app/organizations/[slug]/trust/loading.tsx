import { HonestLoadingShell } from "../../../../features/shell/honest-loading";
import { contextTrustCopy } from "../../../../features/trust/public-context-trust-copy";
import { getRequestLocale } from "../../../../lib/i18n/server";

// Honest loading shell for /organizations/[slug]/trust and /servers/[slug]/trust.
export default async function Loading() {
  const copy = contextTrustCopy(await getRequestLocale());
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip"
      headingId="context-trust-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      headerClassName="nexus-panel min-w-0 space-y-3 overflow-x-clip p-6"
      titleClassName="text-xl font-bold text-primary"
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-24 max-w-full rounded bg-inset" />
        ))}
      </div>
    </HonestLoadingShell>
  );
}
