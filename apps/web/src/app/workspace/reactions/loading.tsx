import { getRequestLocale } from "../../../lib/i18n-server";
import { reactionCopy } from "../../../lib/content-reaction-copy";
export default async function Loading() {
  return (
    <p role="status" className="nexus-panel p-6 text-sm text-muted">
      {reactionCopy(await getRequestLocale()).loading}
    </p>
  );
}
