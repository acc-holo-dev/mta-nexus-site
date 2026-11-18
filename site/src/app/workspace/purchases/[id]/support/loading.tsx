import { orderCaseCopy } from "../../../../../features/commerce/order-case-i18n";
import { HonestLoadingShell } from "../../../../../features/shell/honest-loading";
import { getRequestLocale } from "../../../../../lib/i18n/server";

// Honest loading shell for /workspace/purchases/[id]/support.
export default async function Loading() {
  const locale = await getRequestLocale();
  const typedLocale: "en" | "ru" = locale === "ru" ? "ru" : "en";
  const copy = orderCaseCopy(typedLocale);
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      headingId="purchase-support-loading-heading"
      title={copy.create}
      loadingLabel={copy.loading}
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-10 w-64 rounded bg-inset" />
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </HonestLoadingShell>
  );
}
