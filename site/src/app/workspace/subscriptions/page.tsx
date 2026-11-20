import {
  SubscriptionsWorkspaceScreen,
  subscriptionsWorkspaceMetadata,
} from "../../../features/commerce/subscriptions-workspace-server";

export const dynamic = "force-dynamic";

export const generateMetadata = subscriptionsWorkspaceMetadata;

export default async function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return SubscriptionsWorkspaceScreen(props);
}
