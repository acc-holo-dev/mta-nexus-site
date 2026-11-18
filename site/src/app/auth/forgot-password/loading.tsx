import { HonestLoadingShell } from "../../../features/shell/honest-loading";
import { getDictionary } from "../../../lib/platform/i18n";
import { getRequestLocale } from "../../../lib/platform/i18n-server";

// Honest loading shell for /auth/forgot-password.
export default async function Loading() {
  const dictionary = getDictionary(await getRequestLocale());
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-md space-y-6 overflow-x-clip py-16"
      headingId="auth-forgot-loading-heading"
      title={dictionary.recovery.forgotTitle}
      loadingLabel={dictionary.errors.loading}
      headerClassName="space-y-2 text-center"
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-11 rounded bg-inset" />
        <div className="h-11 rounded bg-inset" />
      </div>
    </HonestLoadingShell>
  );
}
