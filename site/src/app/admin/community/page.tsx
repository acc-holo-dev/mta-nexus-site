import {
  CommunityModerationScreen,
  communityModerationMetadata,
} from "../../../features/community/moderation-server";

export const dynamic = "force-dynamic";
export const generateMetadata = communityModerationMetadata;
export default function Page({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CommunityModerationScreen searchParams={searchParams} />;
}
