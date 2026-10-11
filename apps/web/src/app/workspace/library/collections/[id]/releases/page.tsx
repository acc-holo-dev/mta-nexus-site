import { CollectionReleasesScreen } from "../../../../../../components/collection-releases-screen";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Collection releases | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default function Page(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CollectionReleasesScreen {...props} />;
}
