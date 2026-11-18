import { privateChangeHistoryCopy } from "../../../features/accounts/private-change-history-copy";
import { HonestLoadingShell } from "../../../features/shell/honest-loading";
import { getRequestLocale } from "../../../lib/i18n/server";

export default async function Loading() {
  const copy = privateChangeHistoryCopy(await getRequestLocale());
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-5xl space-y-4 overflow-x-clip py-8"
      headingId="settings-history-loading-heading"
      title={copy.profileTitle}
      loadingLabel={copy.loading}
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-6 w-2/3 rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </HonestLoadingShell>
  );
}
