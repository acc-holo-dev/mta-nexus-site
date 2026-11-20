import {
  CommunityModerationScreen,
  communityModerationMetadata,
} from "../../../../features/community/moderation-server";

export const dynamic = "force-dynamic";

export const generateMetadata = communityModerationMetadata;

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CommunityModerationScreen id={(await params).id} searchParams={searchParams} />;
}
