import { HonestLoadingShell } from "../../../../features/shell/honest-loading";
import { getDictionary } from "../../../../lib/i18n";
import { getRequestLocale } from "../../../../lib/i18n/server";

// Honest loading shell for /admin/support/[id].
export default async function Loading() {
  const copy = getDictionary(await getRequestLocale()).support;
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip"
      headingId="admin-support-case-loading-heading"
      title={copy.staffQueue}
      loadingLabel={copy.loading}
      headerClassName="space-y-2 border-b border-base pb-6"
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-10 w-full max-w-md rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </HonestLoadingShell>
  );
}
