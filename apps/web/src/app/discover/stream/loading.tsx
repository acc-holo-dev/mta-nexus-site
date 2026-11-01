import { getRequestLocale } from "../../../lib/i18n-server";
import { discoveryStreamCopy } from "../../../lib/discovery-stream-copy";
export default async function Loading() {
  const copy = discoveryStreamCopy(await getRequestLocale());
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="nexus-panel min-h-40 space-y-3 p-6 text-sm text-muted"
    >
      <p className="font-medium text-foreground">{copy.title}</p>
      <p>{copy.loading}</p>
    </div>
  );
}
