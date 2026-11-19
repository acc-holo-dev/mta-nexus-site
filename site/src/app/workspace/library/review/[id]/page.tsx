import type { Metadata } from "next";
import { LibraryReviewEditorPage } from "../../../../../features/library/library-review-editor-server";
import { resourceReviewCopy } from "../../../../../features/resources/resource-review-i18n";
import { getRequestLocale } from "../../../../../lib/i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${resourceReviewCopy(await getRequestLocale()).write} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function Page(props: { params: Promise<{ id: string }> }) {
  return LibraryReviewEditorPage(props);
}
