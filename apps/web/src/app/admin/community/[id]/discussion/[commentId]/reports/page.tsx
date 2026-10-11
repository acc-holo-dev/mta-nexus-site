import { DiscussionReportsScreen } from "../../../../../../../components/discussion-reports-screen";
import { discussionReportsCopy } from "../../../../../../../lib/discussion-reports-copy";
import { getRequestLocale } from "../../../../../../../lib/i18n-server";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return {
    title: discussionReportsCopy(await getRequestLocale()).title,
    robots: { index: false, follow: false },
  };
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; commentId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const scope = await params;
  return (
    <DiscussionReportsScreen
      id={scope.id}
      commentId={scope.commentId}
      searchParams={searchParams}
    />
  );
}
