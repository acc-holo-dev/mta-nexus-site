import { profilePrivacyCopy } from "../../../features/accounts/profile-privacy-copy";
import { HonestLoadingShell } from "../../../features/shell/honest-loading";
import { getRequestLocale } from "../../../lib/i18n/server";

// Honest loading shell for /settings/privacy.
export default async function Loading() {
  const copy = profilePrivacyCopy(await getRequestLocale());
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-3xl space-y-6 overflow-x-clip py-8"
      headingId="privacy-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-28 rounded bg-inset" />
        <div className="h-24 rounded bg-inset" />
        <div className="h-24 rounded bg-inset" />
      </div>
    </HonestLoadingShell>
  );
}
