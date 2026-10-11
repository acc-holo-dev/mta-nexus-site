import { moderationCopy } from "../../../../../../../lib/community-moderation-copy";
import { getRequestLocale } from "../../../../../../../lib/i18n-server";
export default async function Loading() {
  return (
    <p role="status" className="nexus-panel p-5 text-muted">
      {moderationCopy(await getRequestLocale()).loading}
    </p>
  );
}
