import {
  DeveloperProfileScreen,
  developerProfileMetadata,
} from "../../../features/accounts/developer-profile-server";

export const dynamic = "force-dynamic";
export const generateMetadata = developerProfileMetadata;

export default async function DeveloperProfilePage(props: {
  params: Promise<{ username: string }>;
  searchParams?: Promise<{ page?: string | string[] }>;
}) {
  return DeveloperProfileScreen(props);
}
