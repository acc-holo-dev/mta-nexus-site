import {
  LibraryUpdatesScreen,
  libraryUpdatesMetadata,
} from "../../../../features/library/library-updates-server";

export const dynamic = "force-dynamic";

export const generateMetadata = libraryUpdatesMetadata;

export default async function Page(props: {
  searchParams: Promise<{ filter?: string | string[]; page?: string | string[] }>;
}) {
  return LibraryUpdatesScreen(props);
}
