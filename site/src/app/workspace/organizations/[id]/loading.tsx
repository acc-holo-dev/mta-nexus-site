import { getOrganizationCopy } from "../../../../features/organizations/organization-workspace-copy";
import { HonestLoadingShell } from "../../../../features/shell/honest-loading";
import { getRequestLocale } from "../../../../lib/platform/i18n-server";

// Honest loading shell for /workspace/organizations/[id].
export default async function Loading() {
  const copy = getOrganizationCopy(await getRequestLocale());
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-5xl space-y-5 overflow-x-clip py-8"
      headingId="organization-loading-heading"
      title={copy.profile}
      loadingLabel={copy.loading}
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-10 w-2/3 max-w-md rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-28 rounded bg-inset" />
        ))}
      </div>
    </HonestLoadingShell>
  );
}
