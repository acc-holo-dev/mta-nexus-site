import { ownDiscussionCopy } from "../../../lib/discussion-workspace-copy";
import { getRequestLocale } from "../../../lib/i18n-server";
export default async function Loading() {
  return (
    <p role="status" className="nexus-panel p-6 text-sm text-muted">
      {ownDiscussionCopy(await getRequestLocale()).loading}
    </p>
  );
}
