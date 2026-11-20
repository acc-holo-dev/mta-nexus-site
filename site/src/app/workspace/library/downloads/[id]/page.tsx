import {
  LibraryDownloadDetailPage,
  libraryDownloadDetailMetadata,
} from "../../../../../features/library/library-download-detail-server";

export const dynamic = "force-dynamic";

export const generateMetadata = libraryDownloadDetailMetadata;

export default async function Page(props: { params: Promise<{ id: string }> }) {
  return LibraryDownloadDetailPage(props);
}
