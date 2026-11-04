import { moderationCopy } from "../../../lib/community-moderation-copy";
import { getRequestLocale } from "../../../lib/i18n-server";

// Honest loading shell for /admin/community.
export default async function Loading() {
  const copy = moderationCopy(await getRequestLocale());
  return (
    <section
      className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip"
      aria-busy="true"
      aria-labelledby="admin-community-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="admin-community-loading-heading" className="text-2xl font-extrabold text-primary">
          {copy.title}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {copy.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-24 rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
