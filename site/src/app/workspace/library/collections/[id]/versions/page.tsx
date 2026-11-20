import {
  LibrarySelectionBatchScreen,
  librarySelectionBatchMetadata,
} from "../../../../../../features/library/selection-batch-server";

export const dynamic = "force-dynamic";
export const generateMetadata = librarySelectionBatchMetadata;
export default function Page(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <LibrarySelectionBatchScreen {...props} />;
}
