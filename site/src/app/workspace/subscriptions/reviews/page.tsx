import {
  SubscriptionReviewsScreen,
  subscriptionReviewsMetadata,
} from "../../../../features/commerce/subscription-reviews-server";

export const dynamic = "force-dynamic";

export const generateMetadata = subscriptionReviewsMetadata;

export default async function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return SubscriptionReviewsScreen(props);
}
