import {
  ModeratedDiscussionScreen,
  moderatedDiscussionMetadata,
} from "../../../../../../features/community/moderated-discussion-server";

export const dynamic = "force-dynamic";

export const generateMetadata = moderatedDiscussionMetadata;

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; commentId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const scope = await params;
  return (
    <ModeratedDiscussionScreen
      id={scope.id}
      commentId={scope.commentId}
      searchParams={searchParams}
    />
  );
}
