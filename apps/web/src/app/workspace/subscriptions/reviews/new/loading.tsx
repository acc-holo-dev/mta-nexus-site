import { getRequestLocale } from "../../../../../lib/i18n-server";
import { subscriptionsCopy } from "../../../../../lib/subscriptions-i18n";

// Honest loading shell for /workspace/subscriptions/reviews/new.
export default async function Loading() {
  const copy = subscriptionsCopy(await getRequestLocale());
  return (
    <section
      className="mx-auto max-w-5xl space-y-6 py-8"
      aria-busy="true"
      aria-labelledby="subscription-review-new-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="subscription-review-new-loading-heading" className="font-display text-primary">
          {copy.title}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {copy.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-10 w-72 rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-24 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
