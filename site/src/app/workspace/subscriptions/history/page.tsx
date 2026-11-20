import {
  SubscriptionHistoryScreen,
  subscriptionHistoryMetadata,
} from "../../../../features/commerce/subscription-history-server";

export const dynamic = "force-dynamic";

export const generateMetadata = subscriptionHistoryMetadata;

export default async function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return SubscriptionHistoryScreen(props);
}
