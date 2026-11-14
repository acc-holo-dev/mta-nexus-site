import { CollectionReleasesScreen } from "../../../../../../components/collection-releases-screen";

const pageShellClass = "min-w-0 overflow-x-clip";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Collection releases | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default function Page(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <div className={pageShellClass}>
      <CollectionReleasesScreen {...props} />
    </div>
  );
}
