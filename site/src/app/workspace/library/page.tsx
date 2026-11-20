import {
  LibraryPageScreen,
  libraryPageMetadata,
} from "../../../features/library/library-page-server";

export const dynamic = "force-dynamic";

export const generateMetadata = libraryPageMetadata;

export default async function Page(props: {
  searchParams: Promise<{
    filter?: string | string[];
    page?: string | string[];
  }>;
}) {
  return LibraryPageScreen(props);
}
