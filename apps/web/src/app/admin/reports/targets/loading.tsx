import { reportGroupsCopy } from "../../../../lib/community-report-groups-copy";
import { getRequestLocale } from "../../../../lib/i18n-server";
export default async function Loading() {
  return (
    <p role="status" className="nexus-panel p-5 text-muted">
      {reportGroupsCopy(await getRequestLocale()).loading}
    </p>
  );
}
