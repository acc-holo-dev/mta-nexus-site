import {
  SubscriptionReceiptScreen,
  subscriptionReceiptMetadata,
} from "../../../../../features/commerce/subscription-receipt-server";

export const dynamic = "force-dynamic";

export const generateMetadata = subscriptionReceiptMetadata;

export default async function Page(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return SubscriptionReceiptScreen(props);
}
