import type { Metadata } from "next";
import { LibraryReviewsScreen } from "../../../../features/library/library-reviews-server";
import { resourceReviewCopy } from "../../../../features/resources/resource-review-i18n";
import { getRequestLocale } from "../../../../lib/i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${resourceReviewCopy(await getRequestLocale()).own} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return LibraryReviewsScreen(props);
}
