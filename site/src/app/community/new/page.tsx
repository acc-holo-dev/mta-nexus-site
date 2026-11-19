import type { Metadata } from "next";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";

export { default } from "../../../features/community/new-topic-page-server";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${getDictionary(await getRequestLocale()).community.newTopic} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}
