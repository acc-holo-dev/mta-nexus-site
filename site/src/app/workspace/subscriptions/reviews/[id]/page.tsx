import type { Metadata } from "next";
import { planReviewsCopy } from "../../../../../features/commerce/plan-reviews-i18n";
import { SubscriptionReviewDetailScreen } from "../../../../../features/commerce/subscription-review-detail-server";
import { getRequestLocale } from "../../../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${planReviewsCopy(await getRequestLocale()).saved} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function Page(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return SubscriptionReviewDetailScreen(props);
}
