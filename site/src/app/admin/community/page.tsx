import { moderationCopy } from "../../../features/community/community-moderation-copy";
import { CommunityModerationScreen } from "../../../features/community/moderation-server";
import { getRequestLocale } from "../../../lib/platform/i18n-server";

const pageShellClass = "min-w-0 overflow-x-clip";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return {
    title: moderationCopy(await getRequestLocale()).title,
    robots: { index: false, follow: false },
  };
}
export default function Page({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <div className={pageShellClass}>
      <CommunityModerationScreen searchParams={searchParams} />
    </div>
  );
}
