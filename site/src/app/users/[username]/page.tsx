import {
  UserProfileScreen,
  userProfileMetadata,
} from "../../../features/accounts/user-profile-server";

export const dynamic = "force-dynamic";
export const generateMetadata = userProfileMetadata;

export default async function UserProfilePage(props: {
  params: Promise<{ username: string }>;
  searchParams?: Promise<{
    page?: string | string[];
    serverPage?: string | string[];
    preview?: string | string[];
  }>;
}) {
  return UserProfileScreen(props);
}
