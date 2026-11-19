import type { Metadata } from "next";
import { libraryReleaseHistoryCopy } from "../../../../features/library/library-release-history-i18n";
import { LibraryReleaseHistoryScreen } from "../../../../features/library/release-history-server";
import { getRequestLocale } from "../../../../lib/i18n/server";

const pageShellClass = "min-w-0 overflow-x-clip";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${libraryReleaseHistoryCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}
export default function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <div className={pageShellClass}>
      <LibraryReleaseHistoryScreen {...props} />
    </div>
  );
}
