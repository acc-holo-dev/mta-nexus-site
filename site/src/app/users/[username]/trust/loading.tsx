import { HonestLoadingShell } from "../../../../features/shell/honest-loading";
import { trustCopy } from "../../../../features/trust/public-user-trust-copy";
import { getRequestLocale } from "../../../../lib/i18n/server";

// Honest loading shell for /users/[username]/trust.
export default async function Loading() {
  const copy = trustCopy(await getRequestLocale());
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip"
      headingId="user-trust-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      headerClassName="nexus-panel min-w-0 space-y-3 overflow-x-clip p-6"
      titleClassName="text-xl font-bold text-primary"
      leading={<div className="h-5 w-32 animate-pulse rounded bg-inset" aria-hidden="true" />}
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-24 rounded bg-inset" />
        ))}
      </div>
    </HonestLoadingShell>
  );
}
