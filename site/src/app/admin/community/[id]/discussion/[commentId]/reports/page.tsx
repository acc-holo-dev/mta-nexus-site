import {
  DiscussionReportsScreen,
  discussionReportsMetadata,
} from "../../../../../../../features/community/discussion-reports-server";

export const dynamic = "force-dynamic";

export const generateMetadata = discussionReportsMetadata;

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
