import {
  AuthorResourcesScreen,
  authorResourcesMetadata,
} from "../../../features/resources/author-resources-server";

export const dynamic = "force-dynamic";

export const generateMetadata = authorResourcesMetadata;

export default async function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return AuthorResourcesScreen(props);
}
