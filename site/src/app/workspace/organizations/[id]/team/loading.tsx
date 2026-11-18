import { organizationTeamCopy } from "../../../../../features/organizations/organization-team-copy";
import { HonestLoadingShell } from "../../../../../features/shell/honest-loading";
import { getRequestLocale } from "../../../../../lib/i18n/server";

export default async function Loading() {
  const copy = organizationTeamCopy(await getRequestLocale());
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-4xl space-y-4 overflow-x-clip py-8"
      headingId="organization-team-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      titleClassName="text-xl font-semibold text-primary"
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-6 w-2/3 rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-16 rounded bg-inset" />
        ))}
      </div>
    </HonestLoadingShell>
  );
}
