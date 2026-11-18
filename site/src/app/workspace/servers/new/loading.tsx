import { getUserPlatformCopy } from "../../../../features/community/user-platform-copy";
import { HonestLoadingShell } from "../../../../features/shell/honest-loading";
import { getDictionary } from "../../../../lib/i18n";
import { getRequestLocale } from "../../../../lib/i18n/server";

// Honest loading shell for /workspace/servers/new — neutral, not create chrome.
export default async function Loading() {
  const locale = await getRequestLocale();
  const copy = getDictionary(locale).serverRegistration;
  const platform = getUserPlatformCopy(locale);
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-2xl space-y-5 overflow-x-clip px-4 py-8 sm:px-0"
      headingId="server-new-loading-heading"
      title={copy.title}
      description={<p className="text-sm text-secondary">{copy.description}</p>}
      loadingLabel={platform.loading}
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-10 w-64 rounded bg-inset" />
        <div className="h-40 rounded bg-inset" />
        <div className="h-24 rounded bg-inset" />
      </div>
    </HonestLoadingShell>
  );
}
