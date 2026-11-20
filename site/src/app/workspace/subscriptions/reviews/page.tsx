import type { Metadata } from "next";
import { planReviewsCopy } from "../../../../features/commerce/plan-reviews-i18n";
import { SubscriptionReviewsScreen } from "../../../../features/commerce/subscription-reviews-server";
import { getRequestLocale } from "../../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${planReviewsCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return SubscriptionReviewsScreen(props);
}
