import type { Metadata } from "next";
import { SubscriptionReceiptScreen } from "../../../../../features/commerce/subscription-receipt-server";
import { subscriptionsCopy } from "../../../../../features/commerce/subscriptions-i18n";
import { getRequestLocale } from "../../../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${subscriptionsCopy(await getRequestLocale()).recorded} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function Page(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return SubscriptionReceiptScreen(props);
}
