import { HonestLoadingShell } from "../../../features/shell/honest-loading";
import { getDictionary } from "../../../lib/platform/i18n";
import { getRequestLocale } from "../../../lib/platform/i18n-server";

// Honest loading shell for /auth/verify-email.
export default async function Loading() {
  const dictionary = getDictionary(await getRequestLocale());
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-md space-y-6 overflow-x-clip py-16"
      headingId="auth-verify-email-loading-heading"
      title={dictionary.recovery.verifyTitle}
      loadingLabel={dictionary.recovery.checkingVerification}
      headerClassName="space-y-2 text-center"
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-28 rounded bg-inset" />
        <div className="h-11 w-40 rounded bg-inset" />
      </div>
    </HonestLoadingShell>
  );
}
