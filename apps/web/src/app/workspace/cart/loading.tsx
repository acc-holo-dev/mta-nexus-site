import { getRequestLocale } from "../../../lib/i18n-server";
import { getResourceCommerceCopy } from "../../../lib/resource-commerce-i18n";

// Honest loading shell for /workspace/cart.
export default async function Loading() {
  const copy = getResourceCommerceCopy(await getRequestLocale());
  return (
    <section
      className="mx-auto max-w-4xl space-y-6 py-8"
      aria-busy="true"
      aria-labelledby="cart-loading-heading"
    >
      <header className="space-y-2 border-b border-base pb-5">
        <h1 id="cart-loading-heading" className="font-display text-primary">
          {copy.cart}
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
