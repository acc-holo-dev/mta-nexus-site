import { LibraryCollectionsScreen } from "../../../../components/library-collections-screen";

const pageShellClass = "min-w-0 overflow-x-clip";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Resource collections | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <div className={pageShellClass}>
      <LibraryCollectionsScreen {...props} view="list" />
    </div>
  );
}
