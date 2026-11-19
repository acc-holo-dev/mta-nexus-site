import type { Metadata } from "next";
import { collectionReleasesCopy } from "../../../../../../features/library/collection-releases-i18n";
import { CollectionReleasesScreen } from "../../../../../../features/library/collection-releases-server";
import { getRequestLocale } from "../../../../../../lib/i18n/server";

const pageShellClass = "min-w-0 overflow-x-clip";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${collectionReleasesCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}
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
