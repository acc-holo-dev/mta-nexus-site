import {
  SubscriptionActivateScreen,
  subscriptionActivateMetadata,
} from "../../../../features/commerce/subscription-activate-server";

export const dynamic = "force-dynamic";

export const generateMetadata = subscriptionActivateMetadata;

export default async function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return SubscriptionActivateScreen(props);
}
