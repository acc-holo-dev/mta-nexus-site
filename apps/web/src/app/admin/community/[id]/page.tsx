import { CommunityModerationScreen } from "../../../../components/community-moderation-screen";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { moderationCopy } from "../../../../lib/community-moderation-copy";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return {
    title: moderationCopy(await getRequestLocale()).title,
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
  return <CommunityModerationScreen id={(await params).id} searchParams={searchParams} />;
}
