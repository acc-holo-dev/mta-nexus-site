import {
  SavedFollowsScreen,
  savedFollowsMetadata,
} from "../../../features/community/saved-follows-page-server";

export const dynamic = "force-dynamic";

export const generateMetadata = savedFollowsMetadata;

export default async function Page(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return SavedFollowsScreen(props);
}
