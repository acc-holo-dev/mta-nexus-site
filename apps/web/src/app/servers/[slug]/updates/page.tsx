import { PublicProfileActivity } from "../../../../components/public-profile-activity";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { publicationCopy } from "../../../../lib/publication-feed-copy";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const copy = publicationCopy(await getRequestLocale());
  return {
    title: copy.serverTitle,
    description: copy.serverDescription,
    robots: { index: false, follow: true },
  };
}
export default async function ServerUpdates({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return PublicProfileActivity({ kind: "server", handle: (await params).slug, searchParams });
}
