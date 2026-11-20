import {
  LibraryVersionsScreen,
  libraryVersionsMetadata,
} from "../../../../../features/library/library-versions-server";

export const dynamic = "force-dynamic";

export const generateMetadata = libraryVersionsMetadata;

export default async function Page(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  return LibraryVersionsScreen(props);
}
