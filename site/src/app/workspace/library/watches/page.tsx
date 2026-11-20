import {
  LibraryWatchesScreen,
  libraryWatchesMetadata,
} from "../../../../features/library/library-watches-server";

export const dynamic = "force-dynamic";

export const generateMetadata = libraryWatchesMetadata;

export default async function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return LibraryWatchesScreen(props);
}
