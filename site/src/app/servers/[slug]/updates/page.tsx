import {
  PublicProfileActivity,
  publicProfileMetadata,
} from "../../../../features/accounts/public-profile-activity-server";

export const dynamic = "force-dynamic";

export const generateMetadata = publicProfileMetadata;

export default async function ServerUpdates({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return PublicProfileActivity({
    kind: "server",
    handle: (await params).slug,
    searchParams,
  });
}
