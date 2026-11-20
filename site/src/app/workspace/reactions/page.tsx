import { reactionCopy } from "../../../features/community/content-reaction-copy";
import { ReactionsPageScreen } from "../../../features/community/reactions-page-server";
import { getRequestLocale } from "../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const copy = reactionCopy(await getRequestLocale());
  return { title: copy.my, description: copy.description, robots: { index: false, follow: false } };
}

export default async function ReactionsPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return ReactionsPageScreen(props);
}
