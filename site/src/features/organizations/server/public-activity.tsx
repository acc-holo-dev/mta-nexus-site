import { getRequestLocale } from "../../../lib/platform/i18n-server";
import { PublicProfileActivity } from "../../accounts/public-profile-activity-server";
import { publicationCopy } from "../../community/publication-feed-copy";

const pageShellClass = "min-w-0 overflow-x-clip";

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
