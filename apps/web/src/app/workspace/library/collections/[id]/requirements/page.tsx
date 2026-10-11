import { CollectionRequirementsScreen } from "../../../../../../components/collection-requirements-screen";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Collection readiness | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default function Page(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CollectionRequirementsScreen {...props} />;
}
