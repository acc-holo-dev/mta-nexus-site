import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n-server";

// Honest loading shell for /acquire (free resource claim).
export default async function Loading() {
  const dictionary = getDictionary(await getRequestLocale());
  return (
    <section
      className="mx-auto min-w-0 max-w-3xl space-y-6 overflow-x-clip py-8"
      aria-busy="true"
      aria-labelledby="acquire-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="acquire-loading-heading" className="font-display text-primary">
          {dictionary.checkout.title}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {dictionary.checkout.loadingProduct}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-28 rounded bg-inset" />
        <div className="h-12 w-48 rounded bg-inset" />
        <div className="h-20 rounded bg-inset" />
      </div>
    </section>
  );
}
