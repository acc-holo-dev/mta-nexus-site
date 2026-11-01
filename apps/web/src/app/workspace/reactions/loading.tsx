import { reactionCopy } from "../../../lib/content-reaction-copy";
import { getRequestLocale } from "../../../lib/i18n-server";

// Honest loading shell for /workspace/reactions.
export default async function Loading() {
  const copy = reactionCopy(await getRequestLocale());
  return (
    <section
      className="mx-auto max-w-4xl space-y-6"
      aria-busy="true"
      aria-labelledby="reactions-loading-heading"
    >
      <header className="border-b border-base pb-6">
        <h1 id="reactions-loading-heading" className="text-2xl font-extrabold text-primary">
          {copy.my}
        </h1>
        <p role="status" className="mt-2 text-sm text-muted">
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
