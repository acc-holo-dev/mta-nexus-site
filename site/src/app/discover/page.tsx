import { DiscoverPage } from "../../features/discovery/discover-page-server";
import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const copy = getDictionary(await getRequestLocale()).discover;
  return { title: copy.title, description: copy.description };
}

export default async function Page(props: {
  searchParams: Promise<{
    type?: string | string[];
    q?: string | string[];
    [key: string]: string | string[] | undefined;
  }>;
}) {
  return DiscoverPage(props);
}
