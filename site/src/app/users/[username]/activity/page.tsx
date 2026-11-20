import {
  PublicProfileActivity,
  publicProfileActivityMetadata,
} from "../../../../features/accounts/public-profile-activity-server";

export const dynamic = "force-dynamic";

export const generateMetadata = publicProfileActivityMetadata;

export default async function UserActivity({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return PublicProfileActivity({
    kind: "user",
    handle: (await params).username,
    searchParams,
  });
}
