import {
  SubscriptionReviewDetailScreen,
  subscriptionReviewDetailMetadata,
} from "../../../../../features/commerce/subscription-review-detail-server";

export const dynamic = "force-dynamic";

export const generateMetadata = subscriptionReviewDetailMetadata;

export default async function Page(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return SubscriptionReviewDetailScreen(props);
}
