import { getRequestLocale } from "../../../lib/i18n/server";
import { PublicProfileActivity } from "../../accounts/public-profile-activity-server";
import { publicationCopy } from "../../community/publication-feed-copy";
import { pageShellClip as pageShellClass } from "../../shell/page-shell";

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
