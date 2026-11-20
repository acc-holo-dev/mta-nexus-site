import {
  PublicSubscriptionsScreen,
  publicSubscriptionsMetadata,
} from "../../features/commerce/public-subscriptions-server";

export const dynamic = "force-dynamic";

export const generateMetadata = publicSubscriptionsMetadata;

export default async function Page(props: {
  searchParams: Promise<{ scope?: string | string[]; page?: string | string[] }>;
}) {
  return PublicSubscriptionsScreen(props);
}
