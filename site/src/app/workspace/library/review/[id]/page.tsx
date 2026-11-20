import {
  LibraryReviewEditorPage,
  libraryReviewEditorMetadata,
} from "../../../../../features/library/library-review-editor-server";

export const dynamic = "force-dynamic";

export const generateMetadata = libraryReviewEditorMetadata;

export default async function Page(props: { params: Promise<{ id: string }> }) {
  return LibraryReviewEditorPage(props);
}
