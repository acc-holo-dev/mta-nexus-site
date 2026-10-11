import { LibraryCollectionsScreen } from "../../../../components/library-collections-screen";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Resource collections | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <LibraryCollectionsScreen {...props} view="list" />;
}
