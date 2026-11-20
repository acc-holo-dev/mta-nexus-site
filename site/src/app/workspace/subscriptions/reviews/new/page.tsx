import type { Metadata } from "next";
import { planReviewsCopy } from "../../../../../features/commerce/plan-reviews-i18n";
import { SubscriptionReviewCreateScreen } from "../../../../../features/commerce/subscription-review-create-server";
import { getRequestLocale } from "../../../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${planReviewsCopy(await getRequestLocale()).newReview} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return SubscriptionReviewCreateScreen(props);
}
