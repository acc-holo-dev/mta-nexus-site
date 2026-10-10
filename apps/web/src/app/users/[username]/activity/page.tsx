import { PublicProfileActivity } from "../../../../components/public-profile-activity";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { publicationCopy } from "../../../../lib/publication-feed-copy";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: publicationCopy(await getRequestLocale()).activity };
}
export default async function UserActivity({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return PublicProfileActivity({ kind: "user", handle: (await params).username, searchParams });
}
