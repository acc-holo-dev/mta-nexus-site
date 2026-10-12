import type { Metadata } from "next";
import { LibraryMembershipHistoryScreen } from "../../../../../../components/library-membership-history-screen";
import { getRequestLocale } from "../../../../../../lib/i18n-server";
import { libraryMembershipHistoryCopy } from "../../../../../../lib/library-membership-history-i18n";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${libraryMembershipHistoryCopy(await getRequestLocale()).detail} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}
export default function Page(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <LibraryMembershipHistoryScreen {...props} />;
}
