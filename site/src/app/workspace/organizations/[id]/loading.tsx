import { getOrganizationCopy } from "../../../../features/organizations/organization-workspace-copy";
import { RouteHonestLoading } from "../../../../features/shell/route-honest-loading-server";
import { getRequestLocale } from "../../../../lib/i18n/server";

export default async function Loading() {
  const copy = getOrganizationCopy(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="organization-loading-heading"
      title={copy.profile}
      loadingLabel={copy.loading}
      className="mx-auto min-w-0 max-w-5xl space-y-5 overflow-x-clip py-8"
      rowClassName="h-28 rounded bg-inset"
      leading={<div className="h-10 w-2/3 max-w-md rounded bg-inset" />}
    />
  );
}
