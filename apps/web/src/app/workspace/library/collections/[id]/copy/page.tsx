import { LibraryCollectionsScreen } from "../../../../../../components/library-collections-screen";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Copy resource collection | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  params: Promise<{ id: string }>;
}) {
  return <LibraryCollectionsScreen {...props} view="copy" />;
}
