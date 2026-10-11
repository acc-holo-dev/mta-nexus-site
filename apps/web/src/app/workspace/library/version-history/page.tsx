import { LibraryReleaseHistoryScreen } from "../../../../components/library-release-history-screen";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Version selection history | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <LibraryReleaseHistoryScreen {...props} />;
}
