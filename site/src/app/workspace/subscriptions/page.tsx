import type { Metadata } from "next";
import { subscriptionsCopy } from "../../../features/commerce/subscriptions-i18n";
import { SubscriptionsWorkspaceScreen } from "../../../features/commerce/subscriptions-workspace-server";
import { getRequestLocale } from "../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${subscriptionsCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return SubscriptionsWorkspaceScreen(props);
}
