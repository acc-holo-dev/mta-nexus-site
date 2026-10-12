import { reportHistoryCopy } from "../../../../../lib/community-report-history-copy";
import { getRequestLocale } from "../../../../../lib/i18n-server";
export default async function Loading() {
  return (
    <p role="status" className="nexus-panel p-5 text-muted">
      {reportHistoryCopy(await getRequestLocale()).loading}
    </p>
  );
}
