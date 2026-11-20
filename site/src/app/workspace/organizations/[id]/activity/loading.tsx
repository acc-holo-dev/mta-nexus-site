import { organizationGovernanceCopy } from "../../../../../features/organizations/organization-governance-copy";
import { RouteHonestLoading } from "../../../../../features/shell/route-honest-loading-server";
import { getRequestLocale } from "../../../../../lib/i18n/server";

export default async function Loading() {
  const copy = organizationGovernanceCopy(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="organization-activity-loading-heading"
      title={copy.history}
      loadingLabel={copy.historyDescription}
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      rowClassName="h-24 rounded bg-inset"
      leading={<div className="h-10 w-2/3 max-w-md rounded bg-inset" />}
    />
  );
}
