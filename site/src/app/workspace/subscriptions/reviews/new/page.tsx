import {
  SubscriptionReviewCreateScreen,
  subscriptionReviewCreateMetadata,
} from "../../../../../features/commerce/subscription-review-create-server";

export const dynamic = "force-dynamic";

export const generateMetadata = subscriptionReviewCreateMetadata;

export default async function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return SubscriptionReviewCreateScreen(props);
}
