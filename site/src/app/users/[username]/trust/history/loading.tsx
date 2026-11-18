import { HonestLoadingShell } from "../../../../../features/shell/honest-loading";
import { approvalCopy } from "../../../../../features/trust/public-verification-history-copy";
import { getRequestLocale } from "../../../../../lib/platform/i18n-server";

// Honest loading shell for /users/[username]/trust/history.
export default async function Loading() {
  const copy = approvalCopy(await getRequestLocale());
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip"
      headingId="user-trust-history-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      headerClassName="nexus-panel min-w-0 space-y-3 overflow-x-clip p-6"
      titleClassName="text-xl font-bold text-primary"
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </HonestLoadingShell>
  );
}
