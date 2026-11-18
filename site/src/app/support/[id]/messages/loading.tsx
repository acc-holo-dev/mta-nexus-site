import { HonestLoadingShell } from "../../../../features/shell/honest-loading";
import { supportMessageCopy } from "../../../../features/support/support-message-discovery-copy";
import { getRequestLocale } from "../../../../lib/platform/i18n-server";

// Honest loading shell for /support/[id]/messages.
export default async function Loading() {
  const copy = supportMessageCopy(await getRequestLocale());
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip"
      headingId="support-messages-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      headerClassName="space-y-3 border-b border-base pb-6"
      titleClassName="text-2xl font-extrabold text-primary"
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
