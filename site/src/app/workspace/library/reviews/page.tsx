import {
  LibraryReviewsScreen,
  libraryReviewsMetadata,
} from "../../../../features/library/library-reviews-server";

export const dynamic = "force-dynamic";

export const generateMetadata = libraryReviewsMetadata;

export default async function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return LibraryReviewsScreen(props);
}
