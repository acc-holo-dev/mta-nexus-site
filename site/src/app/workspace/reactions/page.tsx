import {
  ReactionsPageScreen,
  reactionsPageMetadata,
} from "../../../features/community/reactions-page-server";

export const dynamic = "force-dynamic";

export const generateMetadata = reactionsPageMetadata;

export default async function Page(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return ReactionsPageScreen(props);
}
