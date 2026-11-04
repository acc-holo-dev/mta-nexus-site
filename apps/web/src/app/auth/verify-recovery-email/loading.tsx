import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n-server";

// Honest loading shell for /auth/verify-recovery-email.
export default async function Loading() {
  const dictionary = getDictionary(await getRequestLocale());
  return (
    <section
      className="mx-auto min-w-0 max-w-md space-y-6 overflow-x-clip py-16"
      aria-busy="true"
      aria-labelledby="auth-verify-loading-heading"
    >
      <header className="space-y-2 text-center">
        <h1 id="auth-verify-loading-heading" className="font-display text-primary">
          {dictionary.recovery.verifyTitle}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {dictionary.recovery.checkingVerification}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-28 rounded bg-inset" />
        <div className="h-11 w-40 rounded bg-inset" />
      </div>
    </section>
  );
}
