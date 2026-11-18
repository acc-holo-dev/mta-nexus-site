import { HonestLoadingShell } from "../../../features/shell/honest-loading";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";

// Honest loading shell for /users/[username].
export default async function Loading() {
  const copy = getDictionary(await getRequestLocale()).profiles;
  return (
    <HonestLoadingShell
      className="min-w-0 space-y-6 overflow-x-clip"
      headingId="profile-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-28 rounded bg-inset" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-32 rounded bg-inset" />
          <div className="h-32 rounded bg-inset" />
        </div>
      </div>
    </HonestLoadingShell>
  );
}
