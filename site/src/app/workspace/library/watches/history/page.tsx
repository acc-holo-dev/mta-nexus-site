import {
  LibraryWatchHistoryScreen,
  libraryWatchHistoryMetadata,
} from "../../../../../features/library/library-watch-history-server";

export const dynamic = "force-dynamic";

export const generateMetadata = libraryWatchHistoryMetadata;

export default async function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return LibraryWatchHistoryScreen(props);
}
