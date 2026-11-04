import type { Metadata } from "next";
import { LibraryCollectionsScreen } from "../../../../../../components/library-collections-screen";
import { getRequestLocale } from "../../../../../../lib/i18n-server";
import { libraryCollectionsCopy } from "../../../../../../lib/library-collections-i18n";

const pageShellClass = "min-w-0 overflow-x-clip";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${libraryCollectionsCopy(await getRequestLocale())["move-items"]} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}
export default function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  params: Promise<{ id: string }>;
}) {
  return (
    <div className={pageShellClass}>
      <LibraryCollectionsScreen {...props} view="move-items" />
    </div>
  );
}
