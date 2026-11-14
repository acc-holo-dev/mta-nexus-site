import { PublicProfileActivity } from "../../../../components/public-profile-activity";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { publicationCopy } from "../../../../lib/publication-feed-copy";

const pageShellClass = "min-w-0 overflow-x-clip";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: publicationCopy(await getRequestLocale()).activity };
}
export default async function OrganizationActivity({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <div className={pageShellClass}>
      {
        await PublicProfileActivity({
          kind: "organization",
          handle: (await params).slug,
          searchParams,
        })
      }
    </div>
  );
}
