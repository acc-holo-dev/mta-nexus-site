import type { Metadata } from "next";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { resourceReviewCopy } from "../../../../lib/resource-review-i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${resourceReviewCopy(await getRequestLocale()).title} | MTA NEXUS` };
}

export { PublicResourceReviewsPage as default } from "../../../../features/resources/reviews-server";
