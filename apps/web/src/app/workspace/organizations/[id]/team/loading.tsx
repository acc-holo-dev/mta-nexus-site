import { getRequestLocale } from "../../../../../lib/i18n-server";
import { organizationTeamCopy } from "../../../../../lib/organization-team-copy";
export default async function Loading() {
  return (
    <p role="status" className="nexus-panel p-6 text-sm text-muted">
      {organizationTeamCopy(await getRequestLocale()).loading}
    </p>
  );
}
