import { getRequestLocale } from "../../../lib/i18n/server";
import { PublicProfileActivity } from "../../accounts/public-profile-activity-server";
import { publicationCopy } from "../../community/publication-feed-copy";
import { pageShellClip } from "../../shell/page-shell";

export async function organizationActivityMetadata() {
  return { title: publicationCopy(await getRequestLocale()).activity };
}
export async function OrganizationActivity({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <div className={pageShellClip}>
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
