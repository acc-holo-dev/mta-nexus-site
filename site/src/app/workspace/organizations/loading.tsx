import { getOrganizationCopy } from "../../../features/organizations/organization-workspace-copy";
import { getRequestLocale } from "../../../lib/i18n/server";
import { RouteHonestLoading } from "../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  const copy = getOrganizationCopy(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="organizations-loading-heading"
      title={copy.title}
      loadingLabel={copy.listLoading}
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      leading={<div className="h-28 rounded bg-inset" />}
    />
  );
}
