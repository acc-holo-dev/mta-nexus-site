import {
  LibraryMembershipHistoryScreen,
  libraryMembershipHistoryMetadata,
} from "../../../../../features/library/membership-history-server";

export const dynamic = "force-dynamic";
export const generateMetadata = libraryMembershipHistoryMetadata;
export default function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <LibraryMembershipHistoryScreen {...props} />;
}
