import { ModeratedDiscussionScreen } from "../../../../../components/moderated-discussion-screen";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { moderatedDiscussionCopy } from "../../../../../lib/moderated-discussion-copy";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return {
    title: moderatedDiscussionCopy(await getRequestLocale()).title,
    robots: { index: false, follow: false },
  };
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const scope = await params;
  return <ModeratedDiscussionScreen id={scope.id} searchParams={searchParams} />;
}
