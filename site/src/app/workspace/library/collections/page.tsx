import {
  LibraryCollectionsScreen,
  libraryCollectionsMetadata,
} from "../../../../features/library/collections-server";

export const dynamic = "force-dynamic";
export const generateMetadata = libraryCollectionsMetadata;
export default function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <LibraryCollectionsScreen {...props} view="list" />;
}
