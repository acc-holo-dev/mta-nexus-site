import type { Metadata } from "next";
import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n/server";

export { MarketPage as default } from "../../features/resources/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${getDictionary(await getRequestLocale()).product.market} | MTA NEXUS`,
  };
}
