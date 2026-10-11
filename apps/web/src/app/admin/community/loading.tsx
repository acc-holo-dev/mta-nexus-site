import { getRequestLocale } from "../../../lib/i18n-server";
import { moderationCopy } from "../../../lib/community-moderation-copy";
export default async function Loading() {
  return (
    <p role="status" aria-live="polite" className="nexus-panel p-5 text-sm text-muted">
      {moderationCopy(await getRequestLocale()).loading}
    </p>
  );
}
