import { getResourceCommerceCopy } from "../../../features/resources/resource-commerce-i18n";
import { HonestLoadingShell } from "../../../features/shell/honest-loading";
import { getRequestLocale } from "../../../lib/platform/i18n-server";

// Honest loading shell for /workspace/cart.
export default async function Loading() {
  const copy = getResourceCommerceCopy(await getRequestLocale());
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8"
      headingId="cart-loading-heading"
      title={copy.cart}
      loadingLabel={copy.loading}
      headerClassName="space-y-2 border-b border-base pb-5"
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-24 rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </HonestLoadingShell>
  );
}
