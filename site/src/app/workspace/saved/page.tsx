import { followCopy } from "../../../features/community/follow-workspace-copy";
import { SavedFollowsScreen } from "../../../features/community/saved-follows-page-server";
import { getRequestLocale } from "../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const copy = followCopy(await getRequestLocale());
  return {
    title: copy.title,
    description: copy.description,
    robots: { index: false, follow: false },
  };
}

export default async function Page(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return SavedFollowsScreen(props);
}
