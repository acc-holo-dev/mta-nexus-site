import type { Metadata } from "next";
import { LibraryMembershipHistoryScreen } from "../../../../../components/library-membership-history-screen";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { libraryMembershipHistoryCopy } from "../../../../../lib/library-membership-history-i18n";

const pageShellClass = "min-w-0 overflow-x-clip";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${libraryMembershipHistoryCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}
export default function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <div className={pageShellClass}>
      <LibraryMembershipHistoryScreen {...props} />
    </div>
  );
}
