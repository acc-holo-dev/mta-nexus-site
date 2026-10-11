import { getRequestLocale } from "../../../lib/i18n-server";
import { discoveryStreamCopy } from "../../../lib/discovery-stream-copy";
export default async function Loading() {
  return (
    <p role="status" aria-live="polite" className="nexus-panel p-5 text-sm text-muted">
      {discoveryStreamCopy(await getRequestLocale()).loading}
    </p>
  );
}
