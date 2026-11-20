import { organizationTeamCopy } from "../../../../../features/organizations/organization-team-copy";
import { RouteHonestLoading } from "../../../../../features/shell/route-honest-loading-server";
import { getRequestLocale } from "../../../../../lib/i18n/server";

export default async function Loading() {
  const copy = organizationTeamCopy(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="organization-team-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      className="mx-auto min-w-0 max-w-4xl space-y-4 overflow-x-clip py-8"
      titleClassName="text-xl font-semibold text-primary"
      rowClassName="h-16 rounded bg-inset"
      leading={<div className="h-6 w-2/3 rounded bg-inset" />}
    />
  );
}
