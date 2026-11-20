import type { Metadata } from "next";
import { SubscriptionHistoryScreen } from "../../../../features/commerce/subscription-history-server";
import { subscriptionsCopy } from "../../../../features/commerce/subscriptions-i18n";
import { getRequestLocale } from "../../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${subscriptionsCopy(await getRequestLocale()).history} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return SubscriptionHistoryScreen(props);
}
