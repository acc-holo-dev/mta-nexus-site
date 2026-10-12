import { getRequestLocale } from "../../../lib/i18n-server";
import { privateChangeHistoryCopy } from "../../../lib/private-change-history-copy";
export default async function Loading() {
  const copy = privateChangeHistoryCopy(await getRequestLocale());
  return (
    <div className="nexus-panel space-y-4 p-6" aria-busy="true">
      <p role="status" className="text-sm text-muted">
        {copy.loading}
      </p>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-6 w-2/3 rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </div>
  );
}
