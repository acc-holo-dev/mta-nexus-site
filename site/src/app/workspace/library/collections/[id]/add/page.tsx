import { LibraryCollectionsScreen } from "../../../../../../components/library-collections-screen";

const pageShellClass = "min-w-0 overflow-x-clip";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Add acquired resources | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  params: Promise<{ id: string }>;
}) {
  return (
    <div className={pageShellClass}>
      <LibraryCollectionsScreen {...props} view="add" />
    </div>
  );
}
