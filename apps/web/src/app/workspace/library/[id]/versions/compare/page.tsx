import { LibraryReleaseComparisonScreen } from "../../../../../../components/library-release-comparison-screen";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Compare library releases | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default function Page(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <LibraryReleaseComparisonScreen {...props} />;
}
