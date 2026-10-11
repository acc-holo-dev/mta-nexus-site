import { approvalCopy } from "../../../../../lib/public-verification-history-copy";
import { getRequestLocale } from "../../../../../lib/i18n-server";
export default async function Loading() {
  return (
    <p role="status" className="nexus-panel p-6 text-sm text-muted">
      {approvalCopy(await getRequestLocale()).loading}
    </p>
  );
}
