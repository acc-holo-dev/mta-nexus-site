import type { Metadata } from "next";
import { resourceReviewCopy } from "../../../../features/resources/resource-review-i18n";
import { getRequestLocale } from "../../../../lib/i18n-server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${resourceReviewCopy(await getRequestLocale()).title} | MTA NEXUS` };
}

export { PublicResourceReviewsPage as default } from "../../../../features/resources/reviews-server";
