import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n-server";

// Honest loading shell for /auth/login.
export default async function Loading() {
  const dictionary = getDictionary(await getRequestLocale());
  return (
    <section
      className="mx-auto max-w-md space-y-6 py-16"
      aria-busy="true"
      aria-labelledby="auth-login-loading-heading"
    >
      <header className="space-y-2 text-center">
        <h1 id="auth-login-loading-heading" className="font-display text-primary">
          {dictionary.auth.loginTitle}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {dictionary.errors.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-11 rounded bg-inset" />
        <div className="h-11 rounded bg-inset" />
        <div className="h-11 rounded bg-inset" />
      </div>
    </section>
  );
}
