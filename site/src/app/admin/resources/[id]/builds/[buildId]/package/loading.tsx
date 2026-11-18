import { buildPackageCopy } from "../../../../../../../features/resources/build-package-i18n";
import { HonestLoadingShell } from "../../../../../../../features/shell/honest-loading";
import { getDictionary } from "../../../../../../../lib/i18n";
import { getRequestLocale } from "../../../../../../../lib/i18n/server";

// Honest loading shell for /admin/resources/[id]/builds/[buildId]/package.
export default async function Loading() {
  const locale = await getRequestLocale();
  const copy = buildPackageCopy(locale);
  const admin = getDictionary(locale).admin;
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      headingId="admin-resource-build-package-loading-heading"
      title={copy.inventory}
      loadingLabel={admin.loading}
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-10 w-72 rounded bg-inset" />
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </HonestLoadingShell>
  );
}
