import { HonestLoadingShell } from "../../../../features/shell/honest-loading";
import { getDictionary } from "../../../../lib/platform/i18n";
import { getRequestLocale } from "../../../../lib/platform/i18n-server";

// Honest loading shell for /workspace/servers/[id].
export default async function Loading() {
  const locale = await getRequestLocale();
  const copy = getDictionary(locale).serverManagement;
  const status = getDictionary(locale).serverDetail.loading;
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8"
      headingId="server-management-loading-heading"
      title={copy.listingDetails}
      loadingLabel={status}
      titleClassName="text-2xl font-black text-primary"
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-24 rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-32 rounded bg-inset" />
        ))}
      </div>
    </HonestLoadingShell>
  );
}
