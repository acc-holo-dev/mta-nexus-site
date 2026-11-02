import { getRequestLocale } from "../../../lib/i18n-server";
import { profilePrivacyCopy } from "../../../lib/profile-privacy-copy";

// Honest loading shell for /settings/privacy.
export default async function Loading() {
  const copy = profilePrivacyCopy(await getRequestLocale());
  return (
    <section
      className="mx-auto max-w-3xl space-y-6 py-8"
      aria-busy="true"
      aria-labelledby="privacy-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="privacy-loading-heading" className="font-display text-primary">
          {copy.title}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {copy.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-28 rounded bg-inset" />
        <div className="h-24 rounded bg-inset" />
        <div className="h-24 rounded bg-inset" />
      </div>
    </section>
  );
}
