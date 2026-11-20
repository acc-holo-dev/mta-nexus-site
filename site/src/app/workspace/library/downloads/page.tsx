import {
  LibraryDownloadsScreen,
  libraryDownloadsMetadata,
} from "../../../../features/library/library-downloads-server";

export const dynamic = "force-dynamic";

export const generateMetadata = libraryDownloadsMetadata;

export default async function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return LibraryDownloadsScreen(props);
}
