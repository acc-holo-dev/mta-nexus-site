import type { Metadata } from "next";
import { CartWorkspaceScreen } from "../../../features/commerce/cart-workspace-server";
import { getResourceCommerceCopy } from "../../../features/resources/resource-commerce-i18n";
import { getRequestLocale } from "../../../lib/i18n/server";

const pageShellClass = "min-w-0 overflow-x-clip";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${getResourceCommerceCopy(await getRequestLocale()).cart} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function Page() {
  return <div className={pageShellClass}>{await CartWorkspaceScreen()}</div>;
}
