import { CommunityModerationScreen } from "../../../../components/community-moderation-screen";
export { dynamic, generateMetadata } from "../page";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CommunityModerationScreen id={(await params).id} searchParams={searchParams} />;
}
